'use client';

import { useEffect, useState } from 'react';

/* Tema seçici — üç durumlu: sistem, açık, karanlık.

   İki durumlu (aç/kapa) yapılmadı: kullanıcı bir kez seçim yaparsa
   işletim sistemi akşam karanlığa geçtiğinde panel takip etmez.
   "Sistem" seçeneği o bağı geri kurar ve varsayılandır.

   İlk boyamada tema `app/layout.tsx` içindeki satır içi betikle
   uygulanıyor; burası yalnızca değiştirmek için. */

type Tema = 'sistem' | 'acik' | 'karanlik';

const SECENEKLER: { deger: Tema; etiket: string }[] = [
	{ deger: 'sistem', etiket: 'Sistem' },
	{ deger: 'acik', etiket: 'Açık' },
	{ deger: 'karanlik', etiket: 'Karanlık' },
];

export function TemaSecici() {
	/* Sunucuda hangi temanın seçili olduğu bilinemez (localStorage
	   tarayıcıda). Bağlanmadan önce hiçbirini seçili göstermiyoruz ki
	   sunucu ve istemci çıktısı çelişmesin. */
	const [tema, setTema] = useState<Tema | null>(null);

	useEffect(() => {
		const kayitli = localStorage.getItem('karas-tema');
		setTema(kayitli === 'acik' || kayitli === 'karanlik' ? kayitli : 'sistem');
	}, []);

	function secildi(yeni: Tema) {
		setTema(yeni);
		if (yeni === 'sistem') {
			localStorage.removeItem('karas-tema');
			document.documentElement.removeAttribute('data-tema');
		} else {
			localStorage.setItem('karas-tema', yeni);
			document.documentElement.setAttribute('data-tema', yeni);
		}
	}

	return (
		<div
			role="group"
			aria-label="Tema"
			className="flex shrink-0 border border-kenarlik"
		>
			{SECENEKLER.map((secenek) => {
				const secili = tema === secenek.deger;
				return (
					<button
						key={secenek.deger}
						type="button"
						onClick={() => secildi(secenek.deger)}
						aria-pressed={secili}
						className={`px-3 py-2 font-mono text-[0.625rem] uppercase tracking-[0.08em] transition-colors ${
							secili
								? 'bg-vurgu-metin text-zemin'
								: 'text-metin-3 hover:text-metin'
						}`}
					>
						{secenek.etiket}
					</button>
				);
			})}
		</div>
	);
}
