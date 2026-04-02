# RLG Content Hub

Bộ tài liệu nền để xây dựng nội dung marketing, kiến thức và tư vấn truyền thông cho Reverse Logistics Group Vietnam (RLG Việt Nam).

## Mục tiêu

- Hệ thống hóa kiến thức về RLG, EPR, PRO, tái chế và logistics ngược.
- Tạo nền cho các bài viết Facebook mang tính giáo dục, hữu ích và có khả năng chuyển đổi.
- Giữ giọng văn nhất quán: chuyên nghiệp, dễ hiểu, có trách nhiệm và đúng ngữ cảnh môi trường.

## Cấu trúc thư mục

| File | Vai trò |
| --- | --- |
| `AGENTS.md` | Quy tắc vận hành cho trợ lý nội dung và cách phản hồi trong dự án |
| `data/basis.md` | Tài liệu nền về RLG Việt Nam, mô hình hoạt động và các chủ đề cốt lõi |
| `Supabase.facebook_posts` | Kho dữ liệu bài viết Facebook cũ đã đồng bộ, dùng làm nguồn tham chiếu chính |
| `Supabase.facebook_posts_workspace` | Bảng workspace để lưu, sửa, xoá và đánh dấu các bài viết mới |
| `Supabase.web_pages` | Kho nội dung web đã được crawl và đồng bộ sẵn, dùng làm nguồn knowledge retrieval bổ sung |
| `Supabase.rag_documents` / `Supabase.rag_chunks` | Lớp chunk/index phục vụ RAG, được rebuild từ `facebook_posts` + `web_pages` |

## Cách sử dụng
`
1. Đọc `data/basis.md` để nắm bối cảnh, thuật ngữ và các mảng nội dung ưu tiên.
2. Lấy dữ liệu bài viết cũ từ bảng `facebook_posts` trên Supabase để học giọng văn, độ dài, cấu trúc và cách triển khai bài.
3. Lấy nội dung web từ bảng `web_pages` trên Supabase để học thông điệp global, cấu trúc thông tin và thuật ngữ chuẩn.
4. Tham chiếu `AGENTS.md` trước khi viết nội dung mới để đảm bảo đúng quy tắc.
5. Lấy chunk đã index từ `rag_documents` / `rag_chunks` khi cần RAG context cho AI.
6. Khi tạo bài mới, ưu tiên:
   - Giá trị giáo dục trước, bán hàng sau.
   - Câu chữ rõ ràng, dễ hiểu cho doanh nghiệp.
   - Có nguồn, trích dẫn và hashtag phù hợp.

## Ứng dụng nội bộ

- Ứng dụng Next.js đơn giản đã được dựng để:
  - Đăng nhập bằng mật khẩu nội bộ.
  - Xem danh sách bài viết.
  - Sửa, xoá và tạo mới bài viết.
- Đánh dấu bài đã đăng kèm ngày đăng và link bài.
- Bài viết mới lưu vào bảng `facebook_posts_workspace`, không ghi đè lên `facebook_posts`.
- Khi lưu bài, hệ thống sẽ chặn nội dung trùng với dữ liệu đã đăng hoặc đã lưu trong workspace.
- Kho nội dung web đã được crawler bên ngoài xử lý và đồng bộ vào bảng `web_pages` để agent học thêm thông điệp global, mô tả sản phẩm và thuật ngữ tiếng Anh chuẩn.
- Nội dung từ `web_pages` là nguồn tham chiếu bổ sung, không thay thế bài Facebook cũ.
- Repo này không còn tự triển khai crawl web; dữ liệu web được nạp sẵn qua Supabase.
- Repo có panel `Knowledge Index` để rebuild chunks từ `facebook_posts` + `web_pages` và test retrieval.
- Repo có endpoint `GET /api/knowledge/context` để tạo context pack top chunk cho AI dùng trực tiếp.
- Panel `Knowledge Index` cho phép lọc nguồn, search chunk và copy context pack.
- Chunking mặc định trong index:
  - `facebook_posts`: khoảng 280 từ/chunk, overlap khoảng 80 từ, ưu tiên giữ nguyên hook + body + CTA.
  - `web_pages`: khoảng 520 từ/chunk, overlap khoảng 80 từ, ưu tiên giữ nguyên đoạn theo heading và paragraph.
  - Bilingual separators và block liên hệ nên được giữ trọn trong cùng chunk nếu còn vừa ngưỡng.

## Biến môi trường cần có

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_ACCESS_PASSWORD`
- `APP_SESSION_SECRET`

## Định hướng nội dung

- Chủ đề chính: RLG, recycle, logistics, EPR, PRO, trách nhiệm tái chế, rác thải điện tử, chất thải công nghiệp, kinh tế tuần hoàn.
- Mục tiêu truyền thông: tăng nhận biết, xây dựng uy tín, nuôi dưỡng nhu cầu và hỗ trợ chuyển đổi sang dịch vụ.
- Tư duy nội dung: chia sẻ kiến thức -> tạo niềm tin -> dẫn về dịch vụ -> hỗ trợ bán hàng.
- Mọi nội dung mới nên được xây dựng song ngữ Việt - Anh, với thuật ngữ chuyên ngành được dùng chính xác và nhất quán ở cả hai ngôn ngữ.

## Cấu trúc bài viết quan sát được

- Bài viết cũ trong `facebook_posts` thường có phần tiếng Việt trước, sau đó là phần tiếng Anh.
- Hai ngôn ngữ thường được ngăn bằng một dòng phân tách như `--------` hoặc `------`.
- Cuối bài thường có block thông tin liên hệ gồm địa chỉ, website, số điện thoại và hashtag.
- Nội dung trong `content` có thể chứa:
  - Tiêu đề hoặc hook ở đầu bài.
  - Đoạn mô tả dài ngắn linh hoạt.
  - Bullet list hoặc dòng xuống hàng để làm rõ ý.
  - CTA nhẹ nhàng dẫn về website hoặc dịch vụ.
- Trường `images` thường lưu theo thứ tự đính kèm, có thể gồm tên file nội bộ và URL ảnh CDN.

## Cấu trúc dữ liệu quan sát được

| Cột | Diễn giải quan sát được |
| --- | --- |
| `post_id` | Mã bài viết |
| `date` | Trường ngày hiển thị; nhiều bản ghi đang để trống |
| `content` | Nội dung bài viết song ngữ Việt - Anh |
| `post_url` | Đường dẫn bài đăng; nhiều bản ghi đang để trống |
| `images` | Danh sách ảnh đính kèm theo thứ tự |
| `created_at` | Thời điểm bài được nhập lên hệ thống |

## Quy tắc chống trùng

- Bài mới không được trùng nội dung với bài đã có trong `facebook_posts`.
- Bài mới cũng không được trùng nội dung với dữ liệu đã lưu trong bảng workspace.
- Khi save, hệ thống nên chặn các trường hợp trùng nguyên văn hoặc chỉ khác whitespace/formatting.

## Nguyên tắc chất lượng

- Nội dung phải đúng sự thật, tránh phóng đại hoặc khẳng định khi chưa có nguồn rõ ràng.
- Nếu đề cập quy định pháp luật, cần đối chiếu văn bản hiện hành và ghi nguồn cụ thể.
- Câu chữ nên ngắn gọn, có cấu trúc, dễ dùng lại cho Facebook post hoặc quảng cáo.
- Nên ưu tiên ví dụ thực tế, lợi ích doanh nghiệp, tác hại môi trường và thông điệp hành động.

## Gợi ý đầu ra mong muốn

- Bài tuyên truyền kiến thức.
- Bài giải thích EPR/PRO cho doanh nghiệp.
- Bài cảnh báo tác hại của rác thải và rác thải điện tử.
- Bài giới thiệu dịch vụ thu gom, tái chế, tuân thủ EPR.
- Bài có thể dùng lại cho quảng cáo hoặc chiến dịch truyền thông.
