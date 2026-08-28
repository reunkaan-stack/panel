/* ============================================================
   KURUMSAL BİLGİLER

   Telefon, e-posta, unvan, adres — SADECE burada durur. Müşteriye
   giden her belge (teklif, ileride sözleşme ve fatura) buradan okur;
   bir yerde değiştirmek hepsini günceller.

   ⚠️ Aynı bilgiler karasteknoloji.com sitesinde de var
   (src/consts.ts → SITE, ILETISIM, YASAL). Biri değişirse diğeri de
   değişmeli; müşteri iki farklı numara görmemeli.
   ============================================================ */

export const KURUM = {
	ad: 'Karas Teknoloji',
	unvan: 'Karas Teknoloji ve Mağazacılık İth. İhr. Ltd. Şti.',
	site: 'karasteknoloji.com',
	eposta: 'info@karasteknoloji.com',

	/* Aranabilir biçim bağlantı için, gösterim biçimi ekran için. */
	telefon: '+905075753399',
	telefonGosterim: '0507 575 33 99',

	adres: {
		sokak: 'Paşaalanı Mah. 362. Sok. No: 8/10',
		ilce: 'Karesi',
		il: 'Balıkesir',
		ulke: 'Türkiye',
	},

	vergiDairesi: 'Karesi',
	vergiNo: '5200987216',
} as const;

/** Tek satırlık adres: 'Paşaalanı Mah. 362. Sok. No: 8/10, Karesi / Balıkesir' */
export function adresTekSatir(): string {
	const a = KURUM.adres;
	return `${a.sokak}, ${a.ilce} / ${a.il}`;
}
