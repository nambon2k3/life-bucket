from pydantic import BaseModel, ConfigDict, Field


class BucketCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    icon: str = "•"
    description: str = ""


class BucketOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    icon: str
    description: str
    sort_order: int
    habit_count: int = 0
    project_count: int = 0
