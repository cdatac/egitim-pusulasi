# Güvenlik politikası

## Desteklenen sürümler

Proje henüz ön sürümdedir. Güvenlik düzeltmeleri ana dalın en güncel sürümüne uygulanır.

## Güvenlik açığı bildirme

Çocuk veya aile verisini etkileyebilecek bir güvenlik sorununu herkese açık issue olarak paylaşmayın. GitHub deposu yayımlandığında özel güvenlik bildirimleri etkinleştirilecek ve bu dosyaya iletişim kanalı eklenecektir.

Bildirimde gerçek parola, oturum çerezi, öğrenci adı, okul mesajı veya ekran görüntüsü kullanmayın. Yeniden üretim için sentetik veri tercih edin.

## Güvenlik sınırları

- Sunucu varsayılan olarak yalnızca `127.0.0.1` üzerinde dinler.
- Host ve Origin doğrulaması, başka web sayfalarının yerel API'ye erişmesini sınırlar.
- Arayüz sıkı Content Security Policy ile sunulur.
- K12 bağlayıcıları salt okunur tasarlanır.
- API anahtarları ve oturum bilgileri veritabanına yazılmaz.
- Yerel veritabanı, APK'lar ve ağ kayıtları Git tarafından yok sayılır.
- Bulut AI etkin değilse mesaj içeriği yerel bilgisayardan çıkmaz.

Bu ön sürüm henüz İnternet'e açık bir sunucu olarak çalıştırılmamalıdır.
