import copy
import json
import os
import subprocess
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from ai_advisor import Advice, get_advice, local_advice, validate_advice
from main import Scenario, rescue_advisor, app
from fastapi.testclient import TestClient


class AdvisorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Read the actual JavaScript scenarios so all disasters are exercised.
        module = (Path(__file__).parents[1] / 'frontend/src/data/scenarios.js').as_uri()
        script = f'import {{ scenarios }} from {json.dumps(module)}; console.log(JSON.stringify(scenarios));'
        cls.scenarios = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', script], text=True, encoding='utf-8'))

    def state(self, index=0):
        return Scenario.model_validate(self.scenarios[index]).model_dump()

    def test_all_scenarios_fallback_and_no_mutation(self):
        for index in range(3):
            with self.subTest(disaster=index), patch.dict(os.environ, {'OPENAI_API_KEY': ''}):
                state = self.state(index)
                original = copy.deepcopy(state)
                result = rescue_advisor(Scenario.model_validate(state))
                self.assertEqual(result['source'], 'local')
                validate_advice(Advice.model_validate({k: v for k, v in result.items() if k != 'source'}), state)
                self.assertEqual(state, original)
        self.assertEqual(local_advice(self.state())['priorities'][0]['incident'], 'Nursing Home')

    def test_assigned_incident_moves_last_and_resources_decrease(self):
        state = self.state()
        state['dispatches'] = [{'team': 1, 'incident': 'Nursing Home'}]
        result = local_advice(state)
        self.assertEqual(result['priorities'][-1]['incident'], 'Nursing Home')
        self.assertIn('1 rescue team(s)', result['summary'])

    def test_invented_missing_duplicate_and_bad_ranks_rejected(self):
        state = self.state()
        base = local_advice(state)
        base.pop('source')
        for mutation in ['invented', 'missing', 'duplicate', 'ranks', 'blank']:
            bad = copy.deepcopy(base)
            if mutation == 'invented': bad['priorities'][0]['incident'] = 'Invented Hospital'
            if mutation == 'missing': bad['priorities'].pop()
            if mutation == 'duplicate': bad['priorities'][0]['incident'] = bad['priorities'][1]['incident']
            if mutation == 'ranks': bad['priorities'][0]['priority'] = 2
            if mutation == 'blank': bad['summary'] = ' '
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                validate_advice(Advice.model_validate(bad), state)

    def mock_client(self, state, status='completed', invented=False):
        result = local_advice(state)
        result.pop('source')
        if invented: result['priorities'][0]['incident'] = 'Invented Hospital'
        return SimpleNamespace(status=status, output_text=json.dumps(result))

    def test_valid_mocked_openai_and_schema(self):
        for index in range(3):
            state = self.state(index)
            with self.subTest(disaster=index), patch.dict(os.environ, {'OPENAI_API_KEY': 'test-key'}), patch('ai_advisor.OpenAI') as client:
                client.return_value.__enter__.return_value.responses.create.return_value = self.mock_client(state)
                self.assertEqual(get_advice(state)['source'], 'ai')
                args = client.return_value.__enter__.return_value.responses.create.call_args.kwargs
                self.assertEqual(args['text']['format']['schema']['$defs']['Priority']['properties']['incident']['enum'], [item['name'] for item in state['incidents']])
                self.assertFalse(args['store'])

    def test_api_failure_invalid_output_and_incomplete_fall_back(self):
        state = self.state()
        for failure in ['network', 'invented', 'incomplete', 'malformed']:
            with self.subTest(failure=failure), patch.dict(os.environ, {'OPENAI_API_KEY': 'test-secret'}), patch('ai_advisor.OpenAI') as client:
                call = client.return_value.__enter__.return_value.responses.create
                if failure == 'network': call.side_effect = RuntimeError('test-secret provider error')
                elif failure == 'malformed': call.return_value = SimpleNamespace(status='completed', output_text='not JSON')
                else: call.return_value = self.mock_client(state, status='incomplete' if failure == 'incomplete' else 'completed', invented=failure == 'invented')
                result = get_advice(state)
                self.assertEqual(result['source'], 'local')
                self.assertNotIn('test-secret', json.dumps(result))

    def test_invalid_scenario_assignments_rejected(self):
        for entries in [
            [{'team': 3, 'incident': 'Nursing Home'}],
            [{'team': 1, 'incident': 'Unknown'}],
            [{'team': 1, 'incident': 'Nursing Home'}, {'team': 1, 'incident': 'Office Building'}],
            [{'team': 1, 'incident': 'Nursing Home'}, {'team': 2, 'incident': 'Nursing Home'}],
        ]:
            state = self.state()
            state['dispatches'] = entries
            with self.assertRaises(ValueError): Scenario.model_validate(state)

    def test_new_map_incident_reaches_local_and_openai_advisors(self):
        for index in range(3):
            state = self.state(index)
            state['incidents'].append({
                'name': 'Fictional Map Incident', 'people': 19, 'risk': 'HIGH',
                'description': 'Fictional water damage', 'conditions': 'Fictional water damage',
                'urgency': 2, 'distance': 1.5,
                'latitude': state['mapCenter']['latitude'],
                'longitude': state['mapCenter']['longitude'],
            })
            with self.subTest(disaster=index), TestClient(app) as api:
                with patch.dict(os.environ, {'OPENAI_API_KEY': ''}):
                    response = api.post('/api/rescue-advisor', json=state)
                    self.assertEqual(response.status_code, 200)
                    self.assertEqual(response.json()['source'], 'local')
                    self.assertIn('Fictional Map Incident', [item['incident'] for item in response.json()['priorities']])
                with patch.dict(os.environ, {'OPENAI_API_KEY': 'test-key'}), patch('ai_advisor.OpenAI') as client:
                    call = client.return_value.__enter__.return_value.responses.create
                    call.return_value = self.mock_client(state)
                    response = api.post('/api/rescue-advisor', json=state)
                    self.assertEqual(response.status_code, 200)
                    self.assertEqual(response.json()['source'], 'ai')
                    sent = json.loads(call.call_args.kwargs['input'].split('\n', 1)[1])
                    self.assertEqual(sent['incidents'][-1], state['incidents'][-1])
                    self.assertEqual(sent['shelterLocations'], state['shelterLocations'])

    def test_out_of_range_coordinates_rejected(self):
        with TestClient(app) as api:
            for field, value in [('latitude', 91), ('longitude', -181)]:
                state = self.state()
                state['incidents'][0][field] = value
                response = api.post('/api/rescue-advisor', json=state)
                self.assertEqual(response.status_code, 422)


if __name__ == '__main__':
    unittest.main()
