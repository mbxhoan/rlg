# Maintenance Guide

Tài liệu này mô tả cách giữ tài liệu của repo luôn khớp với code và dữ liệu thật.

## Nguyên tắc cập nhật

- Mọi thay đổi ảnh hưởng đến người dùng cuối phải cập nhật `README.md`.
- Mọi thay đổi về cách agent làm việc phải cập nhật `AGENTS.md`.
- Mọi thay đổi về nền tảng kiến thức, format bài và thuật ngữ phải cập nhật `data/basis.md`.
- Mọi thay đổi về luồng sử dụng nội bộ phải cập nhật `docs/usage.md`.
- Mọi thay đổi đáng kể phải được ghi trong `docs/commit_prompt_map.md`.
- Mọi thay đổi về biến môi trường, model embedding hoặc cấu hình hybrid search phải cập nhật `.env.example` và README.

## Khi nào phải cập nhật tài liệu

- Thêm hoặc xoá route.
- Thay đổi schema Supabase.
- Đổi nguồn dữ liệu ưu tiên.
- Thêm panel, nút, hoặc flow mới trong UI.
- Đổi cách chunking, retrieval hoặc rebuild knowledge.
- Sửa quy tắc viết, terminology hoặc format bài.

## Quy trình khuyến nghị

1. Sửa code hoặc migration.
2. Chạy build và typecheck.
3. Cập nhật `README.md`, `AGENTS.md`, `data/basis.md` và `docs/usage.md` nếu cần.
4. Ghi mapping trong `docs/commit_prompt_map.md`.
5. Kiểm tra lại các link nội bộ trong docs.

## Ghi chú

- Nếu chỉ đổi nội dung nhỏ trong UI, thường chỉ cần cập nhật `docs/usage.md` và `README.md`.
- Nếu chỉ đổi quy tắc nội bộ, thường cần cập nhật `AGENTS.md` và `data/basis.md`.
- Nếu thay đổi nguồn knowledge hoặc RAG flow, phải cập nhật cả bốn file.
