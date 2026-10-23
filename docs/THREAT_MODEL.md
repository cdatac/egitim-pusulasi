# Tehdit modeli

Bu belge Eğitim Pusulası'nın yerel web uygulaması, okul sistemi bağlayıcıları ve isteğe bağlı AI servisi için güvenlik varsayımlarını kaydeder.

## Korunan varlıklar

- Çocuğa ait duyuru, mesaj, görev, tarih, ebeveynin görev tamamlama durumu ve bunlardan üretilen analizler
- Çocuk profil adları
- Okul sistemi parolası, oturum çerezi ve erişim belirteçleri
- İsteğe bağlı AI servisinin API anahtarı
- Ebeveynin hangi iletiyi hangi servise gönderdiğine ilişkin tercihleri

## Güven sınırları ve veri akışı

```text
K12 uygulaması / kullanıcı girdisi
          |
          | salt okunur, normalleştirilmiş kayıt
          v
Yerel Eğitim Pusulası API'si ----> Yerel SQLite veritabanı
          |                                  |
          | açık ileti başına onay            | dışa aktarma / silme
          v                                  v
İsteğe bağlı AI servisi                 Ebeveynin cihazı
```

Tarayıcı ile yerel API aynı `127.0.0.1` kökenindedir. Bağlayıcı sınırından parola, çerez, token ve benzeri kimlik bilgileri geçirilmez. Dış AI sınırı varsayılan olarak kapalıdır. Responses-uyumlu bir servis `127.0.0.1`, `localhost` veya `::1` üzerinde çalışıyorsa yerel model olarak işaretlenir ve anahtarsız kullanılabilir; önizleme ile açık onay yine zorunludur.

## Tehditler ve kontroller

| Tehdit | Mevcut kontrol | Kalan risk |
| --- | --- | --- |
| Kötü niyetli web sayfasının yerel API'ye istek göndermesi | Host/Origin doğrulaması, yalnızca localhost dinleme, CSP | Aynı kullanıcı hesabındaki kötü amaçlı yerel yazılım bu sınıra dahil değildir |
| Okul kimlik bilgilerinin kaydedilmesi veya Git'e girmesi | Bağlayıcı sözleşmesinde sır alanlarının reddi, `.gitignore`, geçmişi tarayan yayın denetimi | Yeni ve beklenmeyen sır biçimleri elle inceleme gerektirebilir |
| Çocuk verisinin izinsiz AI servisine gönderilmesi | AI varsayılan kapalı, ileti ve soru başına açık onay, yerel kaynak seçimi, gönderim önizlemesi | Kullanıcının seçtiği sağlayıcının saklama koşulları ayrıca değerlendirilmelidir |
| Anahtarsız AI ayarının uzak bir servise veri göndermesi | Anahtarsız yapılandırmayı yalnızca kesin geri-döngü ana bilgisayar adlarında kabul etme; uzak URL'de anahtar zorunluluğu | Aynı cihazdaki kötü amaçlı bir servis yerel model portunu ele geçirebilir |
| Hatalı AI servisinin uygulamayı bekletmesi veya aşırı yanıtla belleği tüketmesi | 30 saniye zaman aşımı, 1 MB akış yanıtı sınırı ve sıkı çıktı normalizasyonu | Çok sayıda kullanıcı onaylı ardışık istek yine yerel kaynak tüketebilir |
| AI yanıtının ilgisiz veya uydurma kaynağa atıf yapması | Dönen kimlikleri yalnızca gerçekten gönderilen en fazla beş iletiyle sınırlandırma ve kaynak karta geri bağlantı | Kaynağın doğru yorumlandığını ebeveyn yine doğrulamalıdır |
| Gereksiz kişisel bilginin buluta gitmesi | E-posta/telefon maskeleme, profil adını göndermeme, profil bazlı kullanıcı maskeleme listesi | Kullanıcının listeye eklemediği dolaylı tanımlayıcılar otomatik tanınmayabilir |
| Profiller arası veri karışması | Sorgu, pano, içe aktarma ve silmede profil kimliği doğrulaması; ilk K12 eşitlemesinde öğrenci kimliğini profile bağlama ve sonraki uyuşmazlığı reddetme | Bilgisayar hesabını paylaşan kişiler aynı yerel uygulamaya erişebilir |
| Bağlayıcının okul sisteminde değişiklik yapması | Yalnızca doğrulanmış gelen kutusu ve ileti-gövdesi okuma uç noktaları; her eşitlemede açık onay | Yeni K12 modülleri salt okunur davranışları ayrı ayrı doğrulanmadan etkinleştirilmez |
| Chrome hata ayıklama bağlantı noktasına başka bir süreç erişmesi | Her çalıştırmada rastgele port, yalnızca loopback `127.0.0.1`, geçici gizli profil, yalnızca aynı porttaki WebSocket ve HTTPS `*.k12net.com` hedef kabulü; Chrome kapanınca bağlantı dosyası ve profil silme | Aynı veya başka bir işletim sistemi hesabındaki kötü amaçlı yerel süreç, pencere açıkken portu tarayabilir; eşitleme sonrası pencere kapatılmalıdır |
| Uydurma AI özeti veya yanlış tarih | Kaynak ileti her analizle birlikte korunur, yerel çıkarım testleri | AI çıktısı ebeveyn doğrulaması olmadan kesin bilgi sayılmamalıdır |
| Yerel veritabanının başka kullanıcıca okunması | Varsayılan localhost erişimi ve işletim sistemi dosya izinleri | Uygulama düzeyinde şifreleme henüz yoktur |
| Bağımlılık tedarik zinciri saldırısı | Çalışma zamanı npm bağımlılığı yok, CI sabit ana Node sürümünü test eder | GitHub Actions sürümleri etiketle sabittir, commit SHA ile sabitlenmemiştir |

## Güvenlik dışı varsayımlar

- Cihazın işletim sistemi ve ebeveyn kullanıcı hesabı güvenilirdir.
- Kullanıcı yalnızca erişmeye yetkili olduğu okul hesabını bağlar.
- Bu ön sürüm İnternet'e açık, çok kullanıcılı bir sunucu olarak çalıştırılmaz.
- Eğitim Pusulası okulun resmî sistemi değildir ve özgün iletinin yerini almaz.

## Yayından önce açık konular

- Not, devamsızlık, ödev, sınav ve diğer K12 modüllerinin salt okunur çağrılarının ayrı ayrı doğrulanması
- Oturum sırları gerekiyorsa işletim sistemi kasası veya yalnızca bellek yaklaşımının uygulanması
- Yerel veritabanı şifrelemesi ve yedekleme tehditlerinin değerlendirilmesi
- Seçilecek AI sağlayıcıları için veri saklama ve eğitim koşullarının belgelenmesi

Yeni bir veri akışı, dış servis veya yazma yetkisi eklendiğinde bu belge güncellenmelidir.
