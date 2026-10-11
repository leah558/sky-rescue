from typing import Literal

from fastapi import FastAPI, Request, HTTPException
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, ConfigDict, Field, model_validator

from ai_advisor import get_advice
from image_advisor import ImageAssessment, MAX_IMAGE_BYTES, ALLOWED_TYPES, validate_image, analyze_image

app = FastAPI(title="SkyRescue Simulation API")


class Coordinates(BaseModel):
    model_config = ConfigDict(extra="forbid")
    latitude: float = Field(ge=-90, le=90, allow_inf_nan=False)
    longitude: float = Field(ge=-180, le=180, allow_inf_nan=False)


class MapLocation(Coordinates):
    name: str = Field(min_length=1, max_length=100)


class DangerZone(MapLocation):
    radius: float = Field(gt=0, le=100000, allow_inf_nan=False)


class Incident(Coordinates):
    name: str = Field(min_length=1, max_length=100)
    people: int = Field(ge=1, le=10000)
    risk: Literal["MODERATE", "HIGH", "CRITICAL"]
    description: str = Field(min_length=1, max_length=600)
    distance: float = Field(ge=0, le=1000)
    conditions: str = Field(min_length=1, max_length=600)
    urgency: int = Field(ge=1, le=3)


class Dispatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    team: int = Field(ge=1)
    incident: str


class Scenario(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(min_length=1, max_length=50)
    disaster: str = Field(min_length=1, max_length=50)
    icon: str = Field(max_length=20)
    location: str = Field(min_length=1, max_length=150)
    overview: str = Field(max_length=300)
    weather: str = Field(min_length=1, max_length=600)
    rescueTeams: int = Field(ge=1, le=20)
    shelters: list[str] = Field(max_length=20)
    shelterLocations: list[MapLocation] = Field(max_length=20)
    mapCenter: Coordinates
    dangerZone: DangerZone | None = None
    blockedRoads: list[str] = Field(max_length=20)
    incidents: list[Incident] = Field(min_length=1, max_length=10)
    dispatches: list[Dispatch] = Field(default_factory=list, max_length=20)
    imageAssessment: ImageAssessment | None = None

    @model_validator(mode="after")
    def check_dispatches(self):
        names = [incident.name for incident in self.incidents]
        if len(names) != len(set(names)):
            raise ValueError("Incident names must be unique")
        teams = [entry.team for entry in self.dispatches]
        assigned = [entry.incident for entry in self.dispatches]
        if len(teams) != len(set(teams)) or len(assigned) != len(set(assigned)):
            raise ValueError("Each team and incident can only be assigned once")
        for entry in self.dispatches:
            if entry.team > self.rescueTeams or entry.incident not in names:
                raise ValueError("Dispatch must use an existing team and incident")
        return self


@app.post("/api/rescue-advisor")
def rescue_advisor(scenario: Scenario):
    # A normal def lets FastAPI run the blocking API call in a worker thread.
    # This endpoint advises only. React owns the player's decisions.
    return get_advice(scenario.model_dump())


@app.post("/api/analyze-image", response_model=ImageAssessment)
async def analyze_uploaded_image(request: Request):
    # React sends the file bytes directly. No multipart temp files or saved files.
    mime = request.headers.get("content-type", "").split(";", 1)[0].lower()
    if mime not in ALLOWED_TYPES:
        raise HTTPException(415, "Please upload a JPEG or PNG image.")
    data = bytearray()
    async for chunk in request.stream():
        if len(data) + len(chunk) > MAX_IMAGE_BYTES:
            raise HTTPException(413, "Please choose an image no larger than 5 MB.")
        data.extend(chunk)
    clean = await run_in_threadpool(validate_image, bytes(data), mime)
    return await run_in_threadpool(analyze_image, clean, mime)
