# NOUÉ — 백참·키링 쇼핑몰

손뜨개 백참·키링을 전시하는 미니멀 쇼핑몰입니다.
**Claude → GitHub → Cloudflare(Workers + D1, 무료)** 흐름으로 운영하도록 만들었습니다.

- 스토어(영문): 첫 화면, 상품 목록(카테고리·정렬·재고 필터), 상품 상세, 소개 페이지
- 관리자(한글): `/admin` — 상품 등록·수정, 사진 업로드, 품절 표시, 카테고리, 사이트 설정
- 브랜드 이름 "NOUÉ"는 임시입니다. **관리자 > 사이트 설정 > 브랜드 이름**에서 바꾸면 로고·제목·하단에 모두 반영됩니다.
- 결제·통계는 아직 없고, 나중에 "애드온"으로 붙일 자리만 마련해 두었습니다 (`docs/ADDONS.md`).

---

## 1. 처음 배포하기

### ① GitHub에 올리기
이 폴더 전체를 GitHub 저장소(예: `noue-shop`)에 올립니다.
Claude에 GitHub을 연결해 두면 Claude가 직접 올리고, 이후 수정도 Claude가 바로 반영합니다.

### ② Cloudflare에 연결하기
1. Cloudflare 대시보드 → **Workers & Pages** → **Create application**
2. **Import a repository** → GitHub 계정 연결 → 이 저장소 선택
3. 설정은 기본값 그대로 두고 **Save and Deploy**
   - Build command: 비워 둠
   - Deploy command: `npx wrangler deploy`
4. 배포가 끝나면 `https://noue-shop.<내-서브도메인>.workers.dev` 주소가 생깁니다.

DB(D1)는 따로 만들 필요가 없습니다. 첫 배포 때 `noue-shop-db`가 자동으로 만들어지고,
테이블과 샘플 상품도 사이트에 처음 접속할 때 자동으로 채워집니다.

> 배포 로그에 D1 관련 오류가 나면: 대시보드 **Storage & Databases → D1**에서 `noue-shop-db`를 직접 만들고,
> 그 Database ID를 `wrangler.jsonc`의 `d1_databases`에 `"database_id": "…"`로 추가한 뒤 다시 올리면 됩니다.

### ③ 관리자 비밀번호 설정 (필수)
1. 대시보드에서 방금 만든 Worker 선택 → **Settings** → **Variables and Secrets** → **Add**
2. Type: **Secret**, Name: `ADMIN_PASSWORD`, Value: 8자 이상의 비밀번호 → **Deploy**
3. `https://…workers.dev/admin` 에 접속해 그 비밀번호로 로그인

비밀번호는 Cloudflare에만 저장되고 GitHub 저장소에는 들어가지 않습니다.
바꾸고 싶으면 같은 곳에서 값을 수정하면 됩니다.

### ④ 내 도메인 연결 (선택)
Worker → **Settings** → **Domains & Routes** → **Add** → **Custom domain** 에서 보유한 도메인을 연결합니다.

---

## 2. 평소 운영

| 하고 싶은 일 | 방법 |
| --- | --- |
| 상품 추가·수정·삭제 | `/admin` → 상품 |
| 품절 표시 | 상품 목록에서 "판매 상태"를 **품절**로 변경 (바로 저장) |
| 첫 화면에 먼저 보이게 | 상품 목록의 ★ 클릭 |
| 브랜드 이름·문구·통화 변경 | `/admin` → 사이트 설정 |
| 첫 화면 사진 변경 | 사이트 설정 → 첫 화면 사진 (없으면 기본 일러스트) |
| 문의 버튼 표시 | 사이트 설정에 이메일 또는 인스타그램 주소 입력 |
| 디자인·기능 변경 | Claude에게 요청 → GitHub에 반영 → Cloudflare가 자동 배포 |

샘플 상품 12개는 자리표시용 그림입니다. 실제 상품을 등록한 뒤 관리자에서 삭제하세요.

**사진 저장**: 올린 사진은 브라우저에서 자동으로 줄여(긴 변 1600px, WebP) 무료 DB에 저장합니다.
카드 등록이 필요 없고 상품 수백 개까지 충분합니다. 더 커지면 R2로 옮길 수 있으며 그때는
`src/routes/media.js` 한 파일만 바꾸면 됩니다.

---

## 3. 폴더 구조

```
public/            정적 파일 (CSS, 글꼴, 샘플 그림, 관리자 화면)
  admin/           관리자 화면 (index.html, admin.js, admin.css)
src/
  index.js         시작점
  routes/          storefront.js(스토어) · admin-api.js(관리자 API) · media.js(사진)
  views/           HTML 템플릿
  lib/             db.js(스키마·자동 마이그레이션) · auth.js(로그인) · settings.js(기본 문구)
  addons/          결제·통계 등 확장 기능 자리
docs/ADDONS.md     애드온 추가 방법
wrangler.jsonc     Cloudflare 설정
```

DB 구조를 바꿀 때는 `src/lib/db.js`의 `MIGRATIONS` 배열 끝에 항목을 추가하면
다음 배포 후 자동 적용됩니다. (기존 항목은 수정하지 않습니다.)

---

## 4. 내 컴퓨터에서 실행해 보기 (선택)

```bash
npm install
cp .dev.vars.example .dev.vars    # 로컬용 관리자 비밀번호
npm run dev                        # http://localhost:8787
```

로컬 DB는 `.wrangler/` 폴더에 따로 만들어지며 실제 사이트 데이터와 섞이지 않습니다.
