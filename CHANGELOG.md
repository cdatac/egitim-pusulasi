# Değişiklik günlüğü

## 0.2.1 — 2026-10-23

- K12 eşitlemesine süre sınırı, eşzamanlı işlem kilidi, yalnızca yeni/eksik ayrıntıları alma ve öğrenci–profil bağlama koruması eklendi.
- K12 Chrome bağlantısı rastgele yerel port ve pencere kapanınca silinen geçici profille sınırlandırıldı.
- Türkçe kazanım algılama, ödev eşleştirme, İstanbul saat dilimi ve geçersiz tarih denetimleri sıkılaştırıldı.
- Takvim çıktısında kaynaksız son tarih ve yanıltıcı tamamlanma zamanı kaldırıldı.
- Arayüz hata durumları, klavye erişilebilirliği, yerel depolama ve indirme temizliği sağlamlaştırıldı.
- Güncel yayın iş akışına, etiket commit'inin ana dal geçmişinde olduğunu doğrulayan bir kapı eklendi; depo yöneticileri için etiket ruleset'i ayrıca önerildi.

> **v0.2.0 uyarısı:** Bu sürüm ön sürüme çevrilmiştir. K12 eşitlemesini kullanmayın. Güncellemeden önce eski K12 Chrome penceresini kapatıp `data/k12-chrome-profile` klasörünü silin veya v0.2.1 Ayarlar ekranındaki güvenli temizleme düğmesini kullanın.

## 0.2.0 — 2026-10-22

- Arayüz Bugün, Haftam, İletiler, Asistan ve Ayarlar sekmelerine ayrıldı.
- K12 mesaj ve duyuruları, ayrılmış Chrome oturumundan açık onayla salt okunur eşitlenebilir.
- Tek tıklamalı/tek komutlu K12 Chrome bağlantı başlatıcıları eklendi.
- Haftanın iletilerinden ders bazlı kazanım haritası ve ödev kontrol listesi oluşturulur.
- Ödevler haftalık kazanımlarla kaynaklı olarak karşılaştırılır; belirsiz eşleşmeler kontrol için işaretlenir.
- Haftalık etkinlik ve görevler `VEVENT`/`VTODO` içeren `.ics` takvimine aktarılabilir.
- K12 içeriğindeki HTML kalıntıları görünümde temizlenir.
- Türkçe kullanım kılavuzu yeni kullanıcı akışına göre yenilendi.

## 0.1.0 — 2026-10-21

- Yerel mesaj saklama, kural tabanlı analiz, profiller, görevler ve kaynaklı özetler yayımlandı.
- İsteğe bağlı ve işlem başına onaylı AI analizi ile soru-cevap eklendi.
- AGPL-3.0 lisanslı ilk açık kaynak sürüm yayımlandı.
