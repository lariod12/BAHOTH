# API Agent (CLI)

Script CLI để chat liên tục với API chat completions (nhập input từ user → trả lời → chờ input tiếp theo).

## Setup (Windows)

### Cách 1: Tự động (khuyến nghị)
```powershell
.\setup_venv.ps1
```

### Cách 2: Thủ công
1. Tạo virtual environment:
```powershell
python -m venv venv
```

2. Kích hoạt virtual environment:
   - PowerShell:
   ```powershell
   .\venv\Scripts\Activate.ps1
   ```
   - CMD:
   ```cmd
   venv\Scripts\activate.bat
   ```

3. Cài đặt dependencies:
```powershell
pip install -r requirements.txt
```

## Chạy agent

```powershell
python agent.py
```

## Cấu hình

Tạo file `.env` trong folder `ai_server` với nội dung:
```
API_KEY=proxypal-local
```
Tuỳ chọn:
- `MODEL_NAME=gemini-3-flash-preview` (mặc định)
- `USE_AUTH=true` (mặc định)

## Lưu ý

- Đảm bảo API server đang chạy trên `http://localhost:8317`
- Model mặc định trong `agent.py` là `gemini-3-flash-preview` (có thể override bằng env `MODEL_NAME` nếu cần)
- File `.env` chứa API key, không commit vào git
