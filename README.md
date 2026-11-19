# Life Buckets

Habit tracking xếp theo khu vực cuộc sống: life buckets, projects, task inbox, và một coach chạy model local.

Bố cục giao diện bám theo board Life Buckets (buckets → projects → inbox). Backend tách riêng để học đúng việc của từng thành phần, không nhét tất cả vào một process.

## Ba process backend

| Process | Việc nó làm | Công nghệ |
| --- | --- | --- |
| `api` | Nhận HTTP, ghi Postgres, trả lời ngay | FastAPI |
| `worker` | Lấy message và làm việc chậm | Celery |
| `beat` | Đặt lịch hàng ngày / hàng tuần | Celery Beat |

RabbitMQ chuyển message. Redis có hai vai trò tách biệt:

- DB `0` — cache dashboard (30 giây) và kết quả hiển thị của worker (activity, reminder, weekly review).
- DB `1` — Celery result backend. UI poll `GET /api/v1/jobs/{task_id}` để thấy `PENDING → STARTED → SUCCESS`.

Postgres là nguồn sự thật. Cache chết thì API vẫn đọc database.

## Luồng đáng xem khi học

Check-in một habit trên UI:

1. `POST /api/v1/habits/{id}/checkins` ghi `habit_checkins` và tính streak ngay.
2. API xóa key `dashboard:v1` trên Redis.
3. API gọi `record_activity.delay(...)`. Celery publish message vào queue `habits` trên RabbitMQ.
4. Worker lấy message, `LPUSH` vào list `activity:feed` trên Redis.
5. Trang System đọc list đó.

Dashboard:

1. Request đầu đọc Postgres và `SETEX dashboard:v1 30`.
2. Request sau, trong 30 giây, trả JSON từ Redis và bật cờ `cached: true`.
3. Mọi lần ghi (check-in, task, project) xóa key đó.

Coach:

1. `POST /api/v1/agent/chat` chạy một graph LangGraph: `agent → tools → agent`.
2. Model là Ollama trên máy host (`qwen2.5:7b` mặc định). Model cần hỗ trợ tool calling (`qwen2.5`, `llama3.1`).
3. Tool ghi dữ liệu gọi cùng service với HTTP API, nên coach check-in một habit giống hệt nút trên UI.
4. Job weekly review dùng cùng graph nhưng tắt tool ghi.

## Cây thư mục

```
habbit-tracking/
├── docker-compose.yml          # postgres, redis, rabbitmq, api, worker, beat
├── Makefile
├── backend/
│   ├── app/
│   │   ├── main.py             # FastAPI, tạo bảng, seed
│   │   ├── api/                # HTTP: một file một resource
│   │   ├── core/               # settings, session, redis cache
│   │   ├── models/             # bảng Postgres
│   │   ├── schemas/            # request / response
│   │   ├── services/           # logic dùng chung cho API, worker, agent
│   │   ├── workers/            # Celery app + task
│   │   └── agent/              # LangGraph, tool, prompt
│   ├── alembic/                # đã nối, xem ghi chú bên dưới
│   └── tests/test_streaks.py
└── frontend/                   # Vite + React + shadcn, không phải Next.js
    └── src/
        ├── components/ui/
        ├── components/layout/
        ├── pages/
        └── lib/
```

API không serve file React. Vite chạy riêng và proxy `/api` sang cổng 8000.

## Chạy

Cần Docker, Node 20+, và [Ollama](https://ollama.com) nếu muốn nói chuyện với coach.

```bash
ollama pull qwen2.5:7b
docker compose up --build
```

Terminal khác:

```bash
cd frontend
npm install
npm run dev
```

Mở:

- App: http://localhost:5173
- API docs: http://localhost:8000/docs
- RabbitMQ: http://localhost:15672 (`habbit` / `habbit`)

Đổi model bằng biến môi trường trước khi `docker compose up`:

```bash
OLLAMA_MODEL=llama3.1 docker compose up --build
```

Postgres trên máy host được map ra cổng **5433**, vì 5432 thường đã có Postgres local. Bên trong Docker các service vẫn nói chuyện qua `postgres:5432`.

API trong container gọi Ollama qua `host.docker.internal:11434`. Nếu chạy uvicorn trên host, copy `.env.example` thành `backend/.env`.

```bash
docker compose up -d postgres redis rabbitmq
cp .env.example backend/.env
cd backend && python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Worker trên host, terminal khác, cùng virtualenv:

```bash
celery -A app.workers.celery_app worker -Q celery,habits,reminders,agent --loglevel=info
```

## Trang trên UI

- **Life Buckets** — board giống ảnh: bucket, project theo trạng thái, inbox rút gọn. Badge cho biết response đến từ Redis hay Postgres.
- **Habits** — check-in hôm nay, streak, thêm habit.
- **Projects** — planned / in progress / completed.
- **Task Inbox** — Today, This week, Pending, Overdue, Completed.
- **AI Coach** — chat với graph. Chip dưới câu trả lời là tool LangGraph đã gọi.
- **System** — sức khỏe Postgres / Redis / RabbitMQ, enqueue 3 job, poll trạng thái, activity feed.

Beat đang đặt lịch theo `Asia/Ho_Chi_Minh`: tính lại streak 6:50, reminder 7:00, weekly review thứ Hai 8:00. Trang System enqueue cùng task đó ngay, không cần đợi lịch.

## Alembic

Lần đầu chạy, `app/main.py` gọi `create_all` rồi seed nếu bảng `buckets` trống. Đủ để học mà không cần một bước migrate.

Alembic đã trỏ vào cùng metadata. Khi sửa model và muốn một file migration:

```bash
cd backend
alembic revision --autogenerate -m "describe the change"
alembic upgrade head
```

Database đã được `create_all` tạo sẵn thì sau revision đầu tiên chạy `alembic stamp head` nếu schema đang khớp, để Alembic không cố tạo lại bảng.

## Test

```bash
cd backend && python -m pytest
```

`tests/test_streaks.py` không cần Postgres. Nó khóa quy tắc streak: còn tính đến hôm qua, đứt khi bỏ lỡ một kỳ, habit tuần vẫn nối qua năm mới.
