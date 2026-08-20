'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { tarayiciIstemcisi } from '@/lib/supabase/tarayici';

export function CikisDugmesi() {
	const yonlendirici = useRouter();
	const [cikiliyor, setCikiliyor] = useState(false);

	async function cik() {
		setCikiliyor(true);
		const supabase = tarayiciIstemcisi();
		await supabase.auth.signOut();
		yonlendirici.replace('/giris');
		yonlendirici.refresh();
	}

	return (
		<button
			type="button"
			onClick={cik}
			disabled={cikiliyor}
			className="border border-kenarlik px-3 py-2 font-mono text-[0.625rem] uppercase tracking-[0.08em] text-metin-3 transition-colors hover:border-metin hover:text-metin disabled:opacity-50"
		>
			{cikiliyor ? 'Çıkılıyor…' : 'Çıkış'}
		</button>
	);
}
