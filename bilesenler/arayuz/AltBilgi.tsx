/* İmza. Her sayfanın en altında, tek yerden.

   Sunucu bileşeni — durumu yok, etkileşimi yok; istemciye tek satır
   JavaScript göndermesi için sebep de yok. */

export function AltBilgi() {
	return (
		<footer className="mt-auto border-t border-kenarlik px-6 py-5">
			<p className="text-center font-mono text-[0.6875rem] tracking-[0.08em] text-metin-3">
				<a
					href="https://karasteknoloji.com"
					target="_blank"
					rel="noreferrer"
					className="transition-colors hover:text-metin"
				>
					Karas Teknoloji
				</a>{' '}
				{/* Kalp okuyucuya "kırmızı kalp" diye seslendirilmesin;
				    imzanın parçası, bilgi değil. */}
				<span aria-hidden="true">❤️</span>
			</p>
		</footer>
	);
}
