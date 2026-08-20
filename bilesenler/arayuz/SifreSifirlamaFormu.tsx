'use client';

import { useState } from 'react';
import { tarayiciIstemcisi } from '@/lib/supabase/tarayici';

/* Şifre sıfırlama isteği.

   Adres kayıtlı olsun olmasın AYNI mesaj gösterilir — hangi e-postanın
   sistemde olduğunu öğrenmek isteyen birine bilgi vermemek için.
   Bkz. standartlar/05-EKRANLAR.md */

export function SifreSifirlamaFormu() {
	const [gonderiliyor, setGonderiliyor] = useState(false);
	const [gonderildi, setGonderildi] = useState(false);
	const [hata, setHata] = useState<string | null>(null);

	async function gonder(olay: React.FormEvent<HTMLFormElement>) {
		olay.preventDefault();
		setHata(null);
		setGonderiliyor(true);

		const eposta = String(new FormData(olay.currentTarget).get('eposta') ?? '').trim();

		try {
			const supabase = tarayiciIstemcisi();
			await supabase.auth.resetPasswordForEmail(eposta, {
				redirectTo: `${window.location.origin}/sifre-belirle`,
			});
			/* Sonuca bakılmaz: hata da olsa aynı mesaj gösterilir. */
			setGonderildi(true);
		} catch {
			setHata('Bağlantı kurulamadı. İnternet bağlantınızı kontrol edin.');
			setGonderiliyor(false);
		}
	}

	if (gonderildi) {
		return (
			<div className="kose-nisan border border-kenarlik p-5">
				<span className="etiket text-vurgu-metin">Gönderildi</span>
				<p className="mt-3 text-sm leading-relaxed text-metin-2">
					Adres sistemde kayıtlıysa sıfırlama bağlantısı gönderildi.
					Gelen kutunuzu kontrol edin; bağlantı 60 dakika geçerlidir.
				</p>
			</div>
		);
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

			{hata && (
				<p role="alert" className="mt-5 border border-hata px-4 py-3 text-sm text-hata">
					{hata}
				</p>
			)}

			<button type="submit" disabled={gonderiliyor} className="dugme dugme-dolu mt-7 w-full">
				{gonderiliyor ? 'Gönderiliyor…' : 'Bağlantı gönder'}
			</button>
		</form>
	);
}
