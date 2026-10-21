# Gizlilik yaklaşımı

Eğitim Pusulası çocukların okul verileriyle çalışır. Bu nedenle veri minimizasyonu ürünün temel şartıdır.

## Varsayılan davranış

- Uygulama yalnızca kullanıcının bilgisayarında `127.0.0.1` üzerinden çalışır.
- Mesajlar yerel SQLite veritabanında saklanır.
- Yerel sınıflandırma kullanıldığında mesajlar üçüncü tarafa gönderilmez.
- K12 parolası bu prototip tarafından saklanmaz.

## İsteğe bağlı bulut AI

Kullanıcı `AI_API_URL`, `AI_API_KEY` ve `AI_MODEL` değişkenlerini kendisi ayarlasa bile içerik otomatik gönderilmez. Her ileti için ayrı **AI ile analiz et** işlemi ve gönderim onayı gerekir. Onay verilirse mesaj başlığı, gönderen, tarih ve gövde seçilen AI servisine analiz için gönderilir. E-posta ve telefon ifadeleri varsayılan olarak maskelenir. API anahtarı tarayıcıya veya veritabanına yazılmaz.

Arayüz, gönderilecek alanları, yaklaşık karakter sayısını ve maskeleme durumunu çağrıdan önce gösterir. Kişi adlarını güvenilir biçimde tanımak için ayrıca kullanıcı tarafından yönetilen maskeleme listesi planlanmaktadır.

## Toplanmayan veriler

Proje telemetri, reklam tanımlayıcısı veya davranışsal profil toplamaz. Proje geliştiricileri kullanıcının yerel veritabanına erişemez.

## Kullanıcının kontrolü

Mevcut sürüm; JSON veri dışa aktarma, seçili iletiyi silme ve tüm yerel mesajlarla analizleri temizleme işlevleri sunar.
