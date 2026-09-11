/* Rapor tablolarının ortak hücreleri.

   İKİ KOPYA VARDI ve ayrışmışlardı: biri scope="col" ve font-medium
   kullanıyordu, diğeri ikisini de kullanmıyordu. Sayı hücrelerinden
   biri font-mono ile hizalıyordu, diğeri tabular-nums ile.

   Kimse bunu bilerek yapmadı — bir tablo bileşene çıkarılırken
   hücreler de kopyalandı ve sonra yalnızca biri düzeltildi. Kopyanın
   nasıl sessizce ayrıştığının canlı örneği.

   Birleştirmede erişilebilir olan seçildi: başlık hücresi scope
   taşıyor, sayı sütunu font-mono ile hizalanıyor. */

export function Th({
	children,
	sag,
}: {
	children: React.ReactNode;
	sag?: boolean;
}) {
	return (
		<th
			scope="col"
			className={`py-2 font-mono text-[0.625rem] font-medium uppercase tracking-[0.08em] text-metin-3 ${
				sag ? 'pl-4 text-right' : 'pr-4 text-left'
			}`}
		>
			{children}
		</th>
	);
}

export function Td({
	children,
	renk,
}: {
	children: React.ReactNode;
	renk?: string;
}) {
	/* Sayılar font-mono: değişken genişlikli rakam sütunu hizasız
	   görünür. */
	return (
		<td className={`py-3 pl-4 text-right font-mono ${renk ?? 'text-metin-2'}`}>
			{children}
		</td>
	);
}
