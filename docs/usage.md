# Hướng dẫn sử dụng RLG Content Hub

Tài liệu này là lối vào nhanh để bắt đầu dùng repo này để tạo, xem, sửa và quản lý nội dung Facebook song ngữ cho RLG Việt Nam.

## 1. Mở đầu nhanh

1. Đọc [README.md](../README.md) để nắm mục tiêu, nguồn dữ liệu và luồng tổng thể.
2. Đọc [data/basis.md](../data/basis.md) để hiểu bối cảnh nội dung, thuật ngữ và format chuẩn.
3. Đọc [AGENTS.md](../AGENTS.md) để biết quy tắc viết, nguồn ưu tiên và cách dùng terminology.
4. Chạy app và đăng nhập bằng mật khẩu nội bộ.

## 2. Dùng app mỗi ngày

1. Mở màn hình workspace.
2. Chọn bài cũ để xem, sửa hoặc xoá.
3. Dán nội dung bài mới vào form nếu cần tạo draft.
4. Kiểm tra `Knowledge Assist` để lấy context liên quan từ `facebook_posts` và `web_pages`.
5. Bấm `Lưu bài` để lưu vào `facebook_posts_workspace`.
6. Khi bài đã đăng lên fanpage, bấm `Đã đăng hôm nay` và dán link bài.

## 3. Khi cần tạo nội dung mới

1. Bắt đầu bằng một hook ngắn, rõ ý.
2. Viết tiếng Việt trước, tiếng Anh sau.
3. Giữ separator song ngữ và block liên hệ nếu format bài cần đầy đủ.
4. Dùng `Knowledge Assist` để đối chiếu giọng văn và thuật ngữ.
5. Nếu cần tham chiếu sâu hơn, mở `Knowledge Index` và lấy context pack.

## 4. Khi thêm dữ liệu mới

1. Nếu là bài Facebook cũ, đồng bộ vào `facebook_posts`.
2. Nếu là nội dung web, đồng bộ vào `web_pages`.
3. Sau đó rebuild knowledge index để cập nhật `rag_documents` và `rag_chunks`.
4. Kiểm tra lại một vài query mẫu trong `Knowledge Index`.

## 5. Khi repo thay đổi

1. Nếu thay đổi UI, cập nhật README và file này.
2. Nếu thay đổi quy tắc viết, cập nhật AGENTS.md và data/basis.md.
3. Nếu thêm/sửa route, schema hoặc pipeline dữ liệu, cập nhật README, AGENTS.md và docs/maintenance.md.
4. Ghi lại thay đổi trong `docs/commit_prompt_map.md`.

## 6. Mốc kiểm tra nhanh

- Đã đăng nhập được.
- Xem được workspace posts.
- `Knowledge Assist` trả context phù hợp.
- `Knowledge Index` rebuild không lỗi.
- Bài mới không trùng với dữ liệu cũ hoặc workspace.
