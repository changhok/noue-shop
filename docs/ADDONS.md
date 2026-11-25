# 애드온으로 기능 추가하기

쇼핑몰 본체(상품 전시·관리자·사진)는 그대로 두고, 결제·통계 같은 기능은
`src/addons/<이름>/index.js` 한 폴더로 추가합니다. 켜고 끄는 것은
`src/addons/index.js`의 `INSTALLED` 배열 한 줄입니다.

```js
// src/addons/index.js
export const INSTALLED = [];                      // 지금: 아무것도 설치 안 됨
export const INSTALLED = [analytics];             // 통계 켜기
export const INSTALLED = [payments, analytics];   // 결제 + 통계
```

## 애드온이 쓸 수 있는 연결 지점

| 필드 | 호출 시점 | 용도 |
| --- | --- | --- |
| `migrations` | 배포 후 첫 요청 | 애드온 전용 테이블 생성 (본체와 같은 자동 마이그레이션) |
| `routes(app)` | Worker 시작 | 페이지·API 경로 등록 (`/checkout`, `/webhooks/...`, `/admin/api/stats` 등) |
| `productActions({ product, settings })` | 상품 상세 렌더링 | 구매 버튼 영역. 반환값이 있으면 기본 "Enquire" 버튼을 대체 |
| `headTags(ctx)` / `bodyEnd(ctx)` | 모든 페이지 | `<head>` 또는 `</body>` 앞에 태그 삽입 (결제 SDK 등) |
| `onPageView({ c, page, product })` | 스토어 페이지 응답 후 | 방문 기록. `waitUntil`로 실행되어 페이지 속도에 영향 없음 |

HTML을 반환할 때는 `src/lib/html.js`의 `html` 태그 함수를 사용합니다 (자동 이스케이프).

## 결제 애드온 (`src/addons/payments/`)

뼈대와 테이블 초안(`orders`, `order_items`, `payments`, `products.stock`)이 들어 있습니다.
완성 순서:

1. 결제 대행사 결정 — 해외 판매 위주면 Stripe·PayPal, 국내 카드·간편결제면 토스페이먼츠·포트원 등
2. `providers/<대행사>.js`에 세 함수 구현: `createCheckout`, `verifyWebhook`, `refund`
3. `routes(app)`에 `POST /checkout`, `POST /webhooks/:provider`, 주문 확인 페이지 추가
4. `productActions()`에서 구매 버튼 반환
5. 대행사 API 키를 Cloudflare **Secret**으로 등록 (저장소에 넣지 않음)
6. 외부 결제 스크립트를 쓰면 `src/routes/storefront.js`의 `Content-Security-Policy`에 해당 도메인 추가
7. `INSTALLED`에 `payments` 추가 → 배포
8. 관리자 화면(`public/admin/admin.js`)에 주문 목록 메뉴 추가

가격은 `products.price`에 통화의 기본 단위(달러, 원)로 저장되어 있습니다.
대행사가 최소 단위(센트)를 요구하면 결제 직전에 `Math.round(price * 100)`으로 변환합니다.

## 통계 애드온 (`src/addons/analytics/`)

쿠키 없이 일별 방문 수를 D1에 집계하는 `onPageView()`와 `page_views` 테이블 초안이 들어 있습니다.
완성 순서:

1. `routes(app)`에 `GET /admin/api/stats` 추가 (`requireAdmin` 사용)
2. 관리자 화면에 통계 메뉴 추가 (일별 방문, 인기 상품, 국가별)
3. `INSTALLED`에 `analytics` 추가 → 배포

무료 한도 참고: D1 쓰기는 하루 10만 행까지 무료이므로, 방문이 그보다 많아지면
Workers Analytics Engine으로 옮기는 편이 좋습니다.
