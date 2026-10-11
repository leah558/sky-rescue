//maps show the New Jersey coast near Toms River, Barnegat Bay, and Seaside Heights.
//edit latitude/longitude to move a marker. urgency remains a number from 1 to 3.
export const scenarios = [
  {
    "id": "flood",
    "disaster": "Flood",
    "icon": "🌊",
    "location": " ",
    "overview": "A flood has hit a coastal New Jersey town! Assess the damage and give the best help possible",
    "weather": "Heavy rainfall · river levels rising · low visibility",
    "rescueTeams": 2,
    "shelters": [
      "Community Hall",
      "Local Gym"
    ],
    "blockedRoads": [
      "River Road",
      "East Bridge"
    ],
    "incidents": [
      {
        "name": "Nursing Home",
        "people": 14,
        "risk": "CRITICAL",
        "description": "Residents with limited mobility need assisted evacuation.",
        "distance": 3.2,
        "conditions": "Water rising rapidly, ground floor flooding.",
        "urgency": 3,
        "latitude": 39.968,
        "longitude": -74.186
      },
      {
        "name": "Residential Neighborhood",
        "people": 21,
        "risk": "HIGH",
        "description": "Residents are sheltering upstairs and awaiting assistance.",
        "distance": 5.1,
        "conditions": "Water continuing to rise, East Bridge blocked.",
        "urgency": 2,
        "latitude": 39.944,
        "longitude": -74.08
      },
      {
        "name": "Office Building",
        "people": 8,
        "risk": "MODERATE",
        "description": "Workers are gathered on an upper floor.",
        "distance": 2.4,
        "conditions": "Water currently stable, occupants can wait.",
        "urgency": 1,
        "latitude": 39.954,
        "longitude": -74.157
      }
    ],
    "mapCenter": {
      "latitude": 39.95,
      "longitude": -74.12
    },
    "dangerZone": {
      "name": "Flood Zone",
      "latitude": 39.95,
      "longitude": -74.12,
      "radius": 4200
    },
    "shelterLocations": [
      {
        "name": "Community Hall",
        "latitude": 39.98,
        "longitude": -74.2
      },
      {
        "name": "Local Gym",
        "latitude": 39.956,
        "longitude": -74.089
      }
    ]
  },
  {
    "id": "wildfire",
    "disaster": "Wildfire",
    "icon": "🔥",
    "location": " ",
    "overview": "A wildfire has hit a New Jersey town! Assess the damage and give the best help possible",
    "weather": "Dry conditions · strong west winds · heavy smoke",
    "rescueTeams": 3,
    "shelters": [
      "Ember County Sports Hall"
    ],
    "blockedRoads": [
      "Pine Ridge Road",
      "Forest Trail Access"
    ],
    "incidents": [
      {
        "name": "Summer Camp",
        "people": 26,
        "risk": "CRITICAL",
        "description": "Children and staff need help evacuating along one remaining route.",
        "distance": 4.8,
        "conditions": "Fire nearby; west winds pushing flames toward camp.",
        "urgency": 3,
        "latitude": 40.023,
        "longitude": -74.21
      },
      {
        "name": "Residential Community",
        "people": 32,
        "risk": "HIGH",
        "description": "Residents need evacuation support, including people with limited mobility.",
        "distance": 3.6,
        "conditions": "Smoke reducing visibility; south exit remains open.",
        "urgency": 2,
        "latitude": 39.987,
        "longitude": -74.156
      },
      {
        "name": "Hiking Group",
        "people": 6,
        "risk": "CRITICAL",
        "description": "Hikers are isolated at a trail clearing.",
        "distance": 6.2,
        "conditions": "Forest Trail Access blocked; fire approaching.",
        "urgency": 3,
        "latitude": 40.004,
        "longitude": -74.239
      },
      {
        "name": "Farm",
        "people": 4,
        "risk": "MODERATE",
        "description": "Farm workers await evacuation assistance.",
        "distance": 2.1,
        "conditions": "Fire farther away; west farm lane open.",
        "urgency": 1,
        "latitude": 39.971,
        "longitude": -74.218
      }
    ],
    "mapCenter": {
      "latitude": 39.99,
      "longitude": -74.15
    },
    "dangerZone": {
      "name": "Wildfire Zone",
      "latitude": 39.99,
      "longitude": -74.15,
      "radius": 5000
    },
    "shelterLocations": [
      {
        "name": "Sports Hall",
        "latitude": 39.997,
        "longitude": -74.117
      }
    ]
  },
  {
    "id": "tornado",
    "disaster": "Tornado",
    "icon": "🌪️",
    "location": " ",
    "overview": "A tornado has hit a New Jersey town! Assess the damage and give the best help possible",
    "weather": "Storm has passed · scattered debris · light rain",
    "rescueTeams": 2,
    "shelters": [
      "District Civic Center",
      "Recreation Hall"
    ],
    "blockedRoads": [
      "Main Street",
      "Highway 9 Eastbound"
    ],
    "incidents": [
      {
        "name": "School",
        "people": 18,
        "risk": "HIGH",
        "description": "Students and staff have minor injuries and need to evacuate.",
        "distance": 1.8,
        "conditions": "Damaged roof, west entrance accessible.",
        "urgency": 2,
        "latitude": 39.97,
        "longitude": -74.175
      },
      {
        "name": "Apartment Building",
        "people": 12,
        "risk": "CRITICAL",
        "description": "Several injured residents are trapped by fallen debris.",
        "distance": 3.1,
        "conditions": "Partial structural collapse, unstable stairwell.",
        "urgency": 3,
        "latitude": 39.946,
        "longitude": -74.084
      },
      {
        "name": "Shopping Center",
        "people": 23,
        "risk": "MODERATE",
        "description": "Shoppers are gathered inside various shops.",
        "distance": 2.5,
        "conditions": "Broken glass outside, north entrance clear.",
        "urgency": 1,
        "latitude": 39.958,
        "longitude": -74.194
      },
      {
        "name": "Highway Accident",
        "people": 7,
        "risk": "CRITICAL",
        "description": "People in damaged vehicles need urgent assistance for injuries.",
        "distance": 5.7,
        "conditions": "Eastbound highway blocked, access from west only.",
        "urgency": 3,
        "latitude": 39.941,
        "longitude": -74.164
      }
    ],
    "mapCenter": {
      "latitude": 39.957,
      "longitude": -74.115
    },
    "dangerZone": {
      "name": "Tornado Damage Zone",
      "latitude": 39.957,
      "longitude": -74.115,
      "radius": 3800
    },
    "shelterLocations": [
      {
        "name": "District Civic Center",
        "latitude": 39.978,
        "longitude": -74.205
      },
      {
        "name": "Recreation Hall",
        "latitude": 39.963,
        "longitude": -74.086
      }
    ]
  }
];
