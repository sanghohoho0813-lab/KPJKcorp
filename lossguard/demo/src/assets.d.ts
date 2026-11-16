// 시연 예시 파일(합성)은 화면 파일 안에 바이트로 들어간다 — 서버에서 따로 받지 않는다(외부 연결 없음)
declare module "*.xlsx" { const bytes: Uint8Array; export default bytes; }
declare module "*.xls" { const bytes: Uint8Array; export default bytes; }
declare module "*.csv" { const bytes: Uint8Array; export default bytes; }
