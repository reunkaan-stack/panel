'use client';

/* Yazdırma çubuğu — kâğıda basılmaz.

   Otomatik yazdırma penceresi açılmıyor: yazı tipleri yüklenmeden
   açılırsa çıktı bozuk çıkıyor ve kullanıcı önce gözden geçirmek
   isteyebiliyor. */

export function YazdirDugmesi() {
	return (
		<div className="yazdirma-yok cubuk">
			<style>{`
				.cubuk {
					position: sticky; top: 0; z-index: 10;
					display: flex; flex-wrap: wrap; align-items: center; gap: 14px;
					background: #16160f; color: #f3f3f1;
					padding: 12px 20px;
					font-family: var(--font-plex-mono), ui-monospace, monospace;
					font-size: 11px; letter-spacing: .1em; text-transform: uppercase;
				}
				.cubuk button {
					background: #e8622a; color: #fff; border: 0;
					padding: 9px 16px; cursor: pointer;
					font: inherit; letter-spacing: .1em;
				}
				.cubuk button:hover { background: #d4551f; }
				.cubuk .ipucu { color: #a8a89a; text-transform: none;
					letter-spacing: normal; font-size: 12px; }
			`}</style>

			<button type="button" onClick={() => window.print()}>
				Yazdır / PDF olarak kaydet
			</button>
			<span className="ipucu">
				Açılan pencerede hedefi <strong>“PDF olarak kaydet”</strong> seçin.
			</span>
		</div>
	);
}
