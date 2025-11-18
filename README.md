# ML-BE: Backend Service

## I. Thiết lập và Khởi động Server

Để chạy được dự án, bạn cần thực hiện các bước sau:

### 1. Cài đặt Dependencies

Mở Terminal trong thư mục gốc của dự án và chạy lệnh:

```bash
npm install
````

### 2\. Thiết lập Biến Môi trường (.env)

Tạo một file có tên **`.env`** ở thư mục gốc của dự án, ngang hàng với file `package.json`. File này chứa các biến môi trường cần thiết để server hoạt động.

> **Lưu ý:** Không được chia sẻ file `.env` chứa các khóa bí mật (Secret Keys) lên mã nguồn công khai (ví dụ: GitHub).

**Nội dung mẫu cho file `.env`:**

```env
# Cổng (Port) ứng dụng sẽ chạy trên localhost
PORT=5000 

# Thông tin Kết nối Cơ sở Dữ liệu (Ví dụ: MongoDB)
DB_URI=mongodb://localhost:27017/your_database_name

# Cấu hình Email Service (Nếu dùng)
EMAIL_USERNAME=your_email@gmail.com
EMAIL_PASSWORD=your_email_password_or_app_password
EMAIL_FROM=ten_hien_thi
```

### 3\. Khởi động Server

Chạy lệnh trên git bash

```bash
npm run dev
```

Server sẽ khởi động tại `http://localhost:<PORT>` (Ví dụ: `http://localhost:5000`).

-----

## II. Kiến trúc Backend (Tách Lớp Chức Năng)

Dự án tuân theo một kiến trúc module hóa giúp tách biệt trách nhiệm rõ ràng cho từng thành phần (Separation of Concerns).

| Thư mục | Mục đích (Vai trò) | Nhiệm vụ chính |
| :--- | :--- | :--- |
| **`configs`** | **Cấu hình** | Chứa các cài đặt cho toàn bộ ứng dụng (ví dụ: Kết nối cơ sở dữ liệu `db.js`, cấu hình server, v.v.). |
| **`controllers`** | **Bộ điều khiển (Controller)** | Xử lý yêu cầu từ Router, gọi tới lớp **Services**, và gửi phản hồi (JSON) về cho client. **Không chứa logic nghiệp vụ phức tạp.** |
| **`middlewares`** | **Middleware** | Các hàm chạy **giữa** Router và Controller. Ví dụ: `authMiddleware.js` dùng để xác thực Token (`verifyToken`), kiểm tra quyền, hoặc validate dữ liệu đầu vào. |
| **`models`** | **Mô hình Dữ liệu (Model)** | Định nghĩa cấu trúc dữ liệu và tương tác với Cơ sở Dữ liệu (ví dụ: Schema Mongoose/Sequelize). |
| **`routes`** | **Định tuyến (Route)** | Định nghĩa các **endpoints** (đường dẫn API), HTTP methods (`GET`, `POST`, v.v.), và gán chúng tới các hàm trong **Controllers**. |
| **`services`** | **Lớp Dịch vụ (Service)** | Chứa **toàn bộ logic nghiệp vụ (Business Logic)** phức tạp. Được gọi bởi **Controllers**. Ví dụ: logic đăng ký, tính toán, xử lý giao dịch. |
| **`utils`** | **Tiện ích (Utilities)** | Chứa các hàm hỗ trợ chung, có thể sử dụng ở nhiều nơi mà không thuộc về bất kỳ lớp kiến trúc nào (ví dụ: `emailService.js` để gửi email, hàm định dạng ngày tháng, hàm mã hóa). |

-----

## III. Quy ước Viết Code (Coding Convention)

Để đảm bảo tính đồng nhất và dễ bảo trì, tất cả thành viên cần tuân thủ các quy ước sau:

### 1\. Đặt tên (Naming)

| Thành phần | Quy ước | Ví dụ |
| :--- | :--- | :--- |
| **Hàm/Biến** | **`camelCase`** (bắt đầu bằng chữ thường, chữ cái đầu của từ tiếp theo viết hoa). | `loginAPI`, `verifyToken`, `userController` |
| **Class/Model** | **`PascalCase`** (chữ cái đầu của mỗi từ viết hoa). | `UserModel`, `AuthService` |
| **File** | **`camelCase`** hoặc **`kebab-case`** (nếu không phải là class). | `authController.js`, `authMiddleware.js`, `user.js` |
| **Hằng số (Constants)** | **`SCREAMING_SNAKE_CASE`** (tất cả đều viết hoa, dùng gạch dưới). | `JWT_SECRET`, `ACCESS_TOKEN_EXPIRATION` |

### 2\. Cấu trúc Hàm

  * **Tách biệt Trách nhiệm:**
      * **Controller Functions** luôn kết thúc bằng **`API`** (Ví dụ: `loginAPI`). Nó chỉ nên xử lý `req, res`, gọi **Service**, và trả về `res`.
      * **Service Functions** luôn chứa logic nghiệp vụ và trả về kết quả.
      * **Middleware Functions** có tham số `(req, res, next)` và luôn gọi `next()` khi hoàn thành hoặc trả về lỗi.
  * **Sử dụng Async/Await:** Luôn sử dụng `async/await` thay vì `.then().catch()` khi làm việc với Promise (ví dụ: thao tác DB) để code đồng bộ và dễ đọc hơn.
  * **Xử lý Lỗi (Error Handling):** Trong các hàm `async`, luôn bọc logic bằng khối **`try...catch`** để bắt lỗi một cách tường minh và trả về lỗi phù hợp cho client.

### 3\. Imports và Exports

  * **Sử dụng `const`** cho các `require` và định nghĩa hàm (trừ khi cần thay đổi).
  * **Nhập (Import) các thư viện bên thứ 3** ở đầu file, sau đó đến các module nội bộ của dự án.
  * **Sử dụng dấu ngoặc nhọn `{ }`** để nhập các export không phải là `default` (Ví dụ: `const { verifyToken } = require(...)`).

### 3\. Imports và Exports

  * **Sử dụng `const`** cho các `require` và định nghĩa hàm (trừ khi cần thay đổi).
  * **Nhập (Import) các thư viện bên thứ 3** ở đầu file, sau đó đến các module nội bộ của dự án.
  * **Sử dụng dấu ngoặc nhọn `{ }`** để nhập các export không phải là `default` (Ví dụ: `const { verifyToken } = require(...)`).
---
> **Lưu ý: Nên đọc kiến thức về JavaScript căn bản để hiểu được syntax cơ bản, đọc kiến thức về backend để hiểu về cấu trúc của thư mục.(Ví dụ đọc hàm bất đồng bộ để hiểu về dự án hơn)**

-----

## IV. Quy tắc Git và Quy trình làm việc

Để duy trì lịch sử code sạch và tránh xung đột, nhóm cần tuân thủ quy trình Git sau:

### 1\. Cấu trúc Branch

  * **`main` / `master`**: Branch ổn định, chỉ chứa code đã được kiểm thử và sẵn sàng triển khai (Deployment). **Không được `push` trực tiếp lên branch này.**
  * **`develop`**: Branch tích hợp chính. Tất cả các branch tính năng (feature branches) phải được hợp nhất (merge) vào đây.
  * **Feature Branches**: Tạo branch mới cho **mỗi nhiệm vụ/tính năng** riêng biệt từ `develop`.
      * **Quy ước đặt tên**: `feature/<tên-tính-năng>` hoặc `fix/<tên-bug>`.
      * **Ví dụ**: `git checkout -b feature/auth-register`

### 2\. Quy trình làm việc cơ bản

1.  **Cập nhật:** Luôn **`pull`** code mới nhất từ branch **`develop`** trước khi bắt đầu công việc.
    ```bash
    git checkout develop
    git pull origin develop
    ```
2.  **Tạo Branch:** Tạo branch làm việc từ `develop`.
    ```bash
    git checkout -b feature/<tên-tính-năng>
    ```
3.  **Commit:** Commit code thường xuyên với thông điệp rõ ràng, tuân thủ quy tắc sau:
      * **Quy tắc Commit Message**: Bắt đầu bằng loại commit và theo sau là mô tả ngắn gọn.
          * `feat`: Thêm tính năng mới. (vd: `feat: add register api logic`)
          * `fix`: Sửa lỗi. (vd: `fix: correct token expiration time`)
          * `refactor`: Tái cấu trúc code mà không thay đổi hành vi.
          * `style`: Thay đổi định dạng/style (không liên quan đến code logic).
4.  **Hoàn thành Tính năng (Push & Pull Request - PR):**
      * Khi hoàn thành, `push` branch của bạn lên remote.
        ```bash
        git push origin feature/<tên-tính-năng>
        ```
      * Tạo **Pull Request (PR)** từ branch của bạn sang branch **`develop`**.
      * Gán người duyệt (Reviewer) và chờ **Duyệt Code (Code Review)**.

### 3\. Giải quyết Xung đột (Conflict)

  * Nếu có xung đột, hãy **`pull`** code mới nhất từ **`develop`** vào branch tính năng của bạn, giải quyết xung đột trên máy cục bộ, và sau đó **`push`** lại. **Không bao giờ merge lên `develop` mà chưa giải quyết xung đột.**

---
> **Lưu ý**: Phải kiểm tra trước khi push tránh conflict, nếu có conflict phải tự xử lý, không ảnh hưởng đến main.
* Không code quá nhiều chức năng để khi push lên không biết phải commit gì.
* Khi bị lỗi kiểu thiếu 1 tí gì đó thêm vào cho đủ nhưng lỡ push rồi, commit cứ dùng fix: ...

