/** Yayın kimliği — public/ altındaki sabit dosyaların adresine eklenir.

    NEDEN VAR: ÖTP ve EDP arayüzleri public/ altında duran sabit
    dosyalar. Adres hiç değişmediği için tarayıcı bir kez önbelleğe
    alınca yeni sürüm yayına çıksa bile eskisini gösteriyordu —
    "kod yayında ama ekranda yok" şikâyetinin kaynağı buydu.

    Deploy başına sabit: önbellek çalışmaya devam ediyor, yalnızca
    yeni yayında geçersizleşiyor.

    İki sayfaya birebir kopyalanmıştı; çerçeveli üçüncü bir program
    eklendiğinde üçüncü kopya olacaktı. */
export const SURUM =
	process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ??
	(process.env.NODE_ENV === 'development' ? String(Date.now()) : 'yerel');
