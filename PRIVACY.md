# Gizlilik yaklaşımı

Eğitim Pusulası çocukların okul verileriyle çalışır. Bu nedenle veri minimizasyonu ürünün temel şartıdır.

## Varsayılan davranış

- Uygulama yalnızca kullanıcının bilgisayarında `127.0.0.1` üzerinden çalışır.
- Mesajlar yerel SQLite veritabanında saklanır.
- Yerel sınıflandırma kullanıldığında mesajlar üçüncü tarafa gönderilmez.
- K12 parolası bu prototip tarafından saklanmaz.

## İsteğe bağlı bulut AI

Kullanıcı `AI_API_URL`, `AI_API_KEY` ve `AI_MODEL` değişkenlerini kendisi ayarlarsa mesaj başlığı, gönderen, tarih ve gövde seçilen AI servisine analiz için gönderilir. API anahtarı tarayıcıya veya veritabanına yazılmaz.

Gelecek sürüm, gönderilecek alanları kullanıcıya önceden gösterecek ve isim/iletişim bilgilerini maskeleme seçeneği sunacaktır.

## Toplanmayan veriler

Proje telemetri, reklam tanımlayıcısı veya davranışsal profil toplamaz. Proje geliştiricileri kullanıcının yerel veritabanına erişemez.

## Kullanıcının kontrolü

Mevcut sürüm; JSON veri dışa aktarma, seçili iletiyi silme ve tüm yerel mesajlarla analizleri temizleme işlevleri sunar.
