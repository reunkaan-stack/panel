/* GET /api/otp/export.xlsx — Excel dışa aktarma, HENÜZ TAŞINMADI.

   Arayüz buraya adres çubuğuyla gidiyor (location.href), yani yanıt
   ekranda açılıyor. JSON dönseydi kullanıcı ham metin görürdü; bu
   yüzden okunur bir sayfa dönüyor.

   Yerel programdaki excel_aktar.py sıfırdan .xlsx üretiyor (zip +
   XML). Taşınacak ama önce ekranların çalıştığından emin olmak
   gerekiyor. */

export const dynamic = 'force-dynamic';

const SAYFA = `<!doctype html>
<html lang="tr"><head><meta charset="utf-8">
<title>Excel raporu</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 30rem; margin: 4rem auto;
         padding: 0 1.5rem; line-height: 1.6; color: #222; }
  h1 { font-size: 1.25rem; }
  p { color: #555; }
  a { color: #b45309; }
</style></head>
<body>
  <h1>Excel raporu henüz taşınmadı</h1>
  <p>Ödeme Takip panele yeni taşındı. Excel dışa aktarma sırada;
     o gelene kadar raporu yereldeki programdan alabilirsiniz.</p>
  <p><a href="javascript:history.back()">← Geri dön</a></p>
</body></html>`;

export async function GET() {
	return new Response(SAYFA, {
		status: 501,
		headers: { 'Content-Type': 'text/html; charset=utf-8' },
	});
}
