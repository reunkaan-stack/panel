import { NextResponse } from 'next/server';

/* DIA içe aktarma — HENÜZ TAŞINMADI.

   Yerel programda .xlsx dosyasını okuyup çek/senet ve kredi taksit
   listelerini eşleştiren yaklaşık 300 satırlık bir bölüm var. Taşıması
   ayrı bir iş; eşleştirme kuralları (hangi kayıt yeni, hangisi
   güncellenecek, hangi durum korunacak) birebir aktarılmalı, yoksa
   yanlış eşleşen bir çek sessizce yanlış duruma geçer.

   Sessizce başarısız olmak yerine ne olduğunu söylüyor: arayüz bu
   mesajı kullanıcıya gösteriyor. */

export const dynamic = 'force-dynamic';

export async function POST() {
	return NextResponse.json(
		{
			error:
				'DIA içe aktarma henüz panele taşınmadı. Şimdilik yereldeki programdan yapın; ' +
				'taşındığında burada çalışacak.',
		},
		{ status: 501 }
	);
}
