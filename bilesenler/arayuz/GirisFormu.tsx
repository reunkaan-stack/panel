'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { tarayiciIstemcisi } from '@/lib/supabase/tarayici';
import { girisKaydet } from './girisEylem';

/* Giriş formu.

   Kayıt ol bağlantısı YOKTUR: kullanıcılar davetle oluşturulur.
   Hata mesajı hangi alanın yanlış olduğunu söylemez — hangi e-postanın
   kayıtlı olduğunu sızdırmamak için. Bkz. standartlar/05-EKRANLAR.md */

export function GirisFormu() {
	const yonlendirici = useRouter();
	const aramaParametreleri = useSearchParams();
	const [gonderiliyor, setGonderiliyor] = useState(false);
	const [hata, setHata] = useState<string | null>(null);

	async function gonder(olay: React.FormEvent<HTMLFormElement>) {
		olay.preventDefault();
		setHata(null);
		setGonderiliyor(true);

		const veri = new FormData(olay.currentTarget);
		const eposta = String(veri.get('eposta') ?? '').trim();
		const sifre = String(veri.get('sifre') ?? '');

		try {
			const supabase = tarayiciIstemcisi();
			const { error } = await supabase.auth.signInWithPassword({
				email: eposta,
				password: sifre,
			});

			if (error) {
				/* Tek ve genel mesaj: "kullanıcı yok" ile "şifre yanlış"
				   ayrımı, kayıtlı e-postaları taramaya izin verir. */
				setHata('E-posta veya şifre hatalı.');
				setGonderiliyor(false);
				return;
			}

			/* Son giriş damgası ve bildirim. BEKLENİYOR.

			   Önce "void" ile ateşlenip bırakılıyordu, hemen ardından
			   yönlendirme geliyordu; tarayıcı sayfayı değiştirirken
			   sunucu eyleminin isteği iptal oluyordu. Sonuç: son_giris
			   hiç yazılmadı, "giriş yaptı" bildirimi hiç düşmedi.
			   İkisi de sessizce kayboldu çünkü eylem kendi içinde
			   hata yutuyor.

			   Beklemek yönlendirmeyi bir ağ gidiş-dönüşü geciktiriyor;
			   düğme zaten "Giriş yapılıyor…" durumunda olduğu için
			   kullanıcı açısından fark edilmiyor. */
			try {
				const damga = await girisKaydet();
				if (!damga.tamam) console.warn('[giris] damga atılamadı:', damga.sebep);
			} catch (e) {
				/* Damga atılamadıysa giriş yine de tamamlanır: kullanıcı
				   kimliğini doğrulamış durumda, onu kapıda tutmak yanlış
				   olur. Dıştaki catch'e bırakılsaydı "Bağlantı kurulamadı"
				   yazıp girişi engellerdi — oysa giriş başarılı. */
				console.warn('[giris] damga atılamadı', e);
			}

			/* Oturum düştüğünde kullanıcı baktığı yere dönsün. Adres
			   dışarıdan geldiği için yalnızca site içi yollara izin
			   verilir — açık yönlendirme açığı olmasın. */
			const devam = aramaParametreleri.get('devam');
			const hedef = devam && devam.startsWith('/') && !devam.startsWith('//') ? devam : '/';

			yonlendirici.replace(hedef);
			yonlendirici.refresh();
		} catch {
			setHata('Bağlantı kurulamadı. İnternet bağlantınızı kontrol edin.');
			setGonderiliyor(false);
		}
	}

	return (
		<form onSubmit={gonder} noValidate>
			<label className="block">
				<span className="etiket">E-posta</span>
				<input
					type="email"
					name="eposta"
					required
					autoComplete="username"
					autoFocus
					className="alan mt-2.5"
				/>
			</label>

			<label className="mt-5 block">
				<span className="etiket">Şifre</span>
				<input
					type="password"
					name="sifre"
					required
					autoComplete="current-password"
					className="alan mt-2.5"
				/>
			</label>

			{hata && (
				<p
					role="alert"
					className="mt-5 border border-hata px-4 py-3 text-sm text-hata"
				>
					{hata}
				</p>
			)}

			<button
				type="submit"
				disabled={gonderiliyor}
				className="dugme dugme-dolu mt-7 w-full"
			>
				{gonderiliyor ? 'Giriş yapılıyor…' : 'Giriş yap'}
			</button>

			<p className="mt-6 text-center">
				<a
					href="/sifre-sifirlama"
					className="font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-metin-3 underline underline-offset-4 hover:text-metin"
				>
					Şifremi unuttum
				</a>
			</p>
		</form>
	);
}
