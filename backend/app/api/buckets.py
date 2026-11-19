from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.cache import invalidate_dashboard
from app.core.database import get_db
from app.models import Bucket
from app.schemas.bucket import BucketCreate, BucketOut
from app.services.bus import publish_activity
from app.services.catalog import create_bucket, delete_bucket
from app.services.serialize import to_bucket

router = APIRouter()


@router.get("", response_model=list[BucketOut])
def list_buckets(db: Session = Depends(get_db)) -> list[BucketOut]:
    buckets = db.scalars(select(Bucket).order_by(Bucket.sort_order, Bucket.id)).all()
    return [to_bucket(bucket, len(bucket.habits), len(bucket.projects)) for bucket in buckets]


@router.post("", response_model=BucketOut, status_code=201)
def post_bucket(payload: BucketCreate, db: Session = Depends(get_db)) -> BucketOut:
    bucket = create_bucket(db, payload.name, payload.icon, payload.description)
    db.commit()
    invalidate_dashboard()
    publish_activity("bucket", f"Added life bucket {bucket.name}")
    return to_bucket(bucket)


@router.delete("/{bucket_id}", status_code=204)
def remove_bucket(bucket_id: int, db: Session = Depends(get_db)) -> Response:
    try:
        name = delete_bucket(db, bucket_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    db.commit()
    invalidate_dashboard()
    publish_activity("bucket", f"Removed life bucket {name}. Its projects moved to General")
    return Response(status_code=204)
