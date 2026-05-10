
<p align="center">
  <img src="assets/fastintra.png" alt="New FastIntra logo" width="640" />
</p>

# New FastIntra

2026년 새로운 인트라넷을 맞아 새로운 FastIntra를 제작하였습니다.

## 실행

```bash
npm install
npm run dev
```

## 사이트


## 주요 변경점 & 안내
- 이전 인트라넷은 Frontend에서 시간과 username 등을 확인해 남의 좌석 빼앗기도 가능했지만, 이제는 확인 결과를 request로 보내주어 서버 밖에서 기예를 부리기 힘들어졌습니다.
- 그러나 이번 인트라넷은 도서관이나 면학실 신청 시 이름이 보이지 않고 남/여로 구분하여 표기해 이에 답답함을 느끼는 사람들이 있습니다.
- 도서관 우선신청, 교교 예약 등의 기능은 추후 추가할 예정입니다.
- 기여는 언제나 환영입니다.

## 이전 FastIntra
- https://github.com/krrrr0/fastintra 

## 구조

- `app/page.jsx`: 메인 페이지 진입점
- `app/api/seats/route.js`: 좌석 조회 API
- `app/api/reservations/route.js`: 예약/취소 API
- `components/SeatReservationApp.jsx`: 화면 상태와 상호작용
- `components/SeatGrid.jsx`: 좌석 그리드 렌더링
- `lib/seats.js`: 100~319번 좌석 생성 로직
- `lib/reservations.js`: 예약 저장소 파일 처리