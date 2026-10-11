import base64
import copy
import io
import json
import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi.testclient import TestClient
from PIL import Image, PngImagePlugin

from image_advisor import MAX_IMAGE_BYTES, ImageAssessment, IMAGE_PROMPT
from main import app
from ai_advisor import SYSTEM_PROMPT, local_advice
import test_advisor

ASSESSMENT = {
    'observations': ['Blue areas surround several roof-like shapes in this test image.'],
    'possible_concerns': ['Access may be limited; the image alone cannot establish this.'],
    'summary': 'A test image with possible water-like areas. Occupants and structural safety cannot be determined.',
    'confidence': 'moderate',
}


def image_bytes(format='PNG'):
    buffer = io.BytesIO()
    image = Image.new('RGB', (100, 80), '#5192b0')
    if format == 'PNG':
        metadata = PngImagePlugin.PngInfo()
        metadata.add_text('PrivateTestMetadata', 'remove-me')
        image.save(buffer, format=format, pnginfo=metadata)
    else:
        image.save(buffer, format=format)
    return buffer.getvalue()


class ImageTests(unittest.TestCase):
    def setUp(self):
        self.api = TestClient(app)
        self.api.__enter__()

    def tearDown(self):
        self.api.__exit__(None, None, None)

    def upload(self, data, mime='image/png'):
        return self.api.post('/api/analyze-image', content=data, headers={'Content-Type': mime})

    def test_jpeg_png_success_structured_response_and_metadata_removal(self):
        for format, mime in [('JPEG', 'image/jpeg'), ('PNG', 'image/png')]:
            with self.subTest(format=format), patch.dict(os.environ, {'OPENAI_API_KEY': 'test-key'}), patch('image_advisor.OpenAI') as client:
                call = client.return_value.__enter__.return_value.responses.create
                call.return_value = SimpleNamespace(status='completed', output_text=json.dumps(ASSESSMENT))
                response = self.upload(image_bytes(format), mime)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json(), ASSESSMENT)
                args = call.call_args.kwargs
                self.assertFalse(args['store'])
                self.assertEqual(args['instructions'], IMAGE_PROMPT)
                self.assertTrue(args['text']['format']['strict'])
                image_url = args['input'][0]['content'][1]['image_url']
                self.assertTrue(image_url.startswith(f'data:{mime};base64,'))
                decoded = Image.open(io.BytesIO(base64.b64decode(image_url.split(',', 1)[1])))
                self.assertEqual(decoded.format, format)
                self.assertNotIn('PrivateTestMetadata', decoded.info)

    def test_invalid_empty_mislabeled_and_oversized_files(self):
        with patch('main.analyze_image') as analyze:
            cases = [
                (b'plain text', 'text/plain', 415),
                (b'<svg/>', 'image/svg+xml', 415),
                (b'not an image', 'image/png', 400),
                (b'', 'image/png', 400),
                (image_bytes('PNG'), 'image/jpeg', 400),
                (b'x' * (MAX_IMAGE_BYTES + 1), 'image/png', 413),
            ]
            for data, mime, status in cases:
                with self.subTest(mime=mime, status=status):
                    self.assertEqual(self.upload(data, mime).status_code, status)
            analyze.assert_not_called()

    def test_large_dimensions_rejected(self):
        data = io.BytesIO()
        Image.new('RGB', (4001, 4000)).save(data, format='PNG')
        with patch('main.analyze_image') as analyze:
            self.assertEqual(self.upload(data.getvalue()).status_code, 400)
            analyze.assert_not_called()

    def test_missing_key(self):
        with patch.dict(os.environ, {'OPENAI_API_KEY': ''}):
            response = self.upload(image_bytes())
            self.assertEqual(response.status_code, 503)
            self.assertIn('simulation still works', response.json()['detail'])

    def test_openai_errors_and_invalid_responses_are_friendly(self):
        for failure in ['network', 'incomplete', 'malformed', 'blank', 'bad_confidence', 'extra']:
            with self.subTest(failure=failure), patch.dict(os.environ, {'OPENAI_API_KEY': 'test-secret'}), patch('image_advisor.OpenAI') as client:
                call = client.return_value.__enter__.return_value.responses.create
                answer = copy.deepcopy(ASSESSMENT)
                if failure == 'network': call.side_effect = RuntimeError('test-secret provider error')
                else:
                    if failure == 'blank': answer['observations'] = [' ']
                    if failure == 'bad_confidence': answer['confidence'] = 'certain'
                    if failure == 'extra': answer['people_inside'] = 50
                    call.return_value = SimpleNamespace(status='incomplete' if failure == 'incomplete' else 'completed', output_text='not JSON' if failure == 'malformed' else json.dumps(answer))
                response = self.upload(image_bytes())
                self.assertEqual(response.status_code, 502)
                self.assertNotIn('test-secret', response.text)

    def test_assessment_supplements_authoritative_incidents(self):
        test_advisor.AdvisorTests.setUpClass()
        scenario = {**test_advisor.AdvisorTests.scenarios[0], 'dispatches': []}
        baseline = copy.deepcopy(scenario)
        scenario['imageAssessment'] = ASSESSMENT
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'test-key'}), patch('ai_advisor.OpenAI') as client:
            call = client.return_value.__enter__.return_value.responses.create
            advice = local_advice(scenario)
            advice.pop('source')
            call.return_value = SimpleNamespace(status='completed', output_text=json.dumps(advice))
            response = self.api.post('/api/rescue-advisor', json=scenario)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()['source'], 'ai')
            sent = json.loads(call.call_args.kwargs['input'].split('\n', 1)[1])
            self.assertEqual(sent['imageAssessment'], ASSESSMENT)
            self.assertEqual(sent['incidents'], baseline['incidents'])
            self.assertIn('remain authoritative', call.call_args.kwargs['instructions'])
            self.api.post('/api/rescue-advisor', json=baseline)
            self.assertEqual(call.call_args.kwargs['instructions'], SYSTEM_PROMPT)
        self.assertEqual(scenario['incidents'], baseline['incidents'])
        with patch.dict(os.environ, {'OPENAI_API_KEY': ''}):
            with_image = self.api.post('/api/rescue-advisor', json=scenario).json()
            without_image = self.api.post('/api/rescue-advisor', json=baseline).json()
            self.assertEqual(with_image, without_image)


if __name__ == '__main__':
    unittest.main()

