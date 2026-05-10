import './globals.css';

export const metadata = {
  title: '도서관 좌석 예약',
  description: '도서관 좌석 조회, 예약, 취소를 위한 데모 웹앱'
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}