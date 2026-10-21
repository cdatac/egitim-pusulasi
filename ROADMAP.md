# Eğitim Pusulası yol haritası

## Nihai hedef

Çocukların okul duyuru ve mesajlarını ebeveyn kontrolünde anlamlandıran, ücretsiz ve açık kaynak, kolay kurulabilir bir eğitim takip sistemi yayımlamak.

## Değişmez ilkeler

- Yerel öncelikli çalışma; mümkün olan veriler kullanıcının cihazında kalır.
- K12 ve diğer okul sistemlerine varsayılan olarak salt okunur erişim.
- Çocuk verilerinin reklam, profil çıkarma veya model eğitimi amacıyla kullanılmaması.
- Her AI özetinin özgün iletiye geri bağlanması.
- Otomatik mesaj gönderme, yoklama veya not değiştirme gibi eylemlerin çekirdek üründe bulunmaması.
- Parola, oturum çerezi, API anahtarı, gerçek okul mesajı, APK veya özel okul varlığının GitHub'a konmaması.
- Özel uygulama kodunu kopyalamadan, belgelenmiş davranış ve temiz oda uygulamasıyla geliştirme.

## Aşamalar

### 0. Güvenli temel — sürüyor

- [x] Yerel web prototipi
- [x] SQLite veri modeli
- [x] Kaynak mesajı koruyan özet kartları
- [x] Yerel kategori, tarih ve görev çıkarma
- [x] Hassas dosyalar için `.gitignore`
- [x] Birim ve API testleri
- [x] Yapılandırma şeması ve `.env.example`
- [x] Veri dışa aktarma ve yerel veri silme kontrolleri
- [x] Birden fazla çocuk için yalıtılmış profiller ve eski veritabanı geçişi

### 1. K12 salt okunur bağlayıcı

- [x] Kimlik bilgilerini reddeden ortak bağlayıcı sözleşmesi
- [x] Kararlı ileti kimliği ve tekrar ayıklama katmanı
- [ ] Duyuru ve mesaj isteklerini yetkili kullanıcı oturumunda doğrulama
- [ ] Oturum bilgilerinin bellekte veya işletim sistemi kasasında tutulması
- [ ] Tekrarlı iletileri güvenilir biçimde ayıklama
- [ ] Yenileme, hata ve oturum süresi dolma davranışları
- [ ] Gerçek veri içermeyen kayıtlı test örnekleri

### 2. Ebeveyn asistanı

- [x] Kaynaklı günlük/haftalık özet
- [x] Ebeveyn kontrollü açık/tamamlandı görev takibi
- [ ] Ödev, sınav, etkinlik, ödeme ve malzeme çıkarma
- [x] Takvim dışa aktarma
- [ ] Mesajlar üzerinde kaynaklı soru-cevap
- [ ] Bulut AI ve yerel model seçenekleri
- [x] Gönderilecek alanlar için görünür gizlilik önizlemesi ve ileti başına onay
- [x] Profil bazında kullanıcı yönetimli özel ifade maskelemesi

### 3. Herkes için dağıtım

- [ ] Windows/macOS/Linux için kolay çalıştırma
- [ ] Güvenli Docker Compose seçeneği (yapılandırma doğrulandı; gerçek imaj derlemesi Docker motoru bekliyor)
- [x] Başlangıç ortamı denetleyicisi
- [ ] İlk kurulum sihirbazı
- [ ] Türkçe kullanım ve güvenlik belgeleri
- [ ] Erişilebilirlik ve mobil uyum

### 4. Açık kaynak yayını

- [ ] Lisans seçimi
- [x] Katkı rehberi ve davranış kuralları
- [x] Güvenlik bildirim politikası
- [x] Tehdit modeli ve gizlilik belgesi
- [x] Çalışma ağacı ve Git geçmişi için otomatik yayın denetimi
- [x] Otomatik test/kalite iş akışı
- [ ] Herkese açık GitHub deposu ve ilk sürüm

## Yayın kapıları

GitHub deposu herkese açılmadan önce:

1. Depo geçmişinde hassas veri bulunmadığı doğrulanır.
2. K12 markasıyla resmî bağlantı izlenimi verilmez.
3. Kullanıcı kendi hesabı ve verisi için açık onay verir.
4. Varsayılan davranış salt okunurdur.
5. Bulut AI kullanılıyorsa hangi verinin gönderileceği açıkça gösterilir.
6. Lisans ve üçüncü taraf bağımlılıkları gözden geçirilir.
