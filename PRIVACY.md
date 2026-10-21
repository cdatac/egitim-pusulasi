# Gizlilik yaklaşımı

Eğitim Pusulası çocukların okul verileriyle çalışır. Bu nedenle veri minimizasyonu ürünün temel şartıdır.

## Varsayılan davranış

- Uygulama yalnızca kullanıcının bilgisayarında `127.0.0.1` üzerinden çalışır.
- Mesajlar, kullanıcının verdiği çocuk profil adları ve ebeveynin işaretlediği görev durumları yerel SQLite veritabanında saklanır.
- Her profilin iletileri, panosu, dışa aktarımı ve silme işlemleri birbirinden ayrıdır.
- Yerel sınıflandırma kullanıldığında mesajlar üçüncü tarafa gönderilmez.
- K12 parolası bu prototip tarafından saklanmaz.
- İlk kurulum ekranı bu sınırları gösterir ve gerçek çocuk adı yerine takma ad kullanılmasını önerir.

## İsteğe bağlı bulut AI

Kullanıcı `AI_API_URL`, `AI_API_KEY` ve `AI_MODEL` değişkenlerini kendisi ayarlasa bile içerik otomatik gönderilmez. Her ileti için ayrı **AI ile analiz et** işlemi ve gönderim onayı gerekir. Onay verilirse mesaj başlığı, gönderen, tarih ve gövde seçilen AI servisine analiz için gönderilir. Profil adı gönderilmez. E-posta ve telefon ifadeleri varsayılan olarak maskelenir. Ebeveyn ayrıca her profil için ad, öğretmen veya okul adı gibi özel ifadeler tanımlayabilir; bunların metindeki eşleşmeleri de çağrıdan önce maskelenir. API anahtarı tarayıcıya veya veritabanına yazılmaz.

Arayüz, gönderilecek alanları, yaklaşık karakter sayısını, maskeleme durumunu ve etkin özel ifade sayısını çağrıdan önce gösterir. Özel maskeleme listesi yalnızca yerel veritabanında tutulur ve AI servisine liste olarak gönderilmez; yalnızca maskelenmiş metin gönderilir.

Kaynaklı soru-cevapta ilgili iletiler önce cihazda seçilir ve en fazla beş ileti kullanılır. Soru, seçilen ileti başlıkları, gönderilecek alanlar ve yaklaşık karakter sayısı kullanıcıya gösterilir. Onaylanan kaynak kimlikleri isteğe sabitlenir ve aynı çocuk profiline ait oldukları sunucuda yeniden doğrulanır. Ayrı onay verilmeden soru veya kaynak içerikleri AI servisine gönderilmez. AI tarafından döndürülen kaynak kimlikleri, yalnızca gerçekten gönderilen iletilerin kimlikleriyle sınırlandırılır.

## Toplanmayan veriler

Proje telemetri, reklam tanımlayıcısı veya davranışsal profil toplamaz. Proje geliştiricileri kullanıcının yerel veritabanına erişemez.

## Kullanıcının kontrolü

Mevcut sürüm; profilleriyle birlikte JSON veri dışa aktarma, seçili iletiyi silme ve seçili profile ait tüm yerel mesajlarla analizleri temizleme işlevleri sunar.

Takvim dışa aktarımı yalnızca kullanıcının düğmeye basmasıyla yerel bir `.ics` dosyası oluşturur. Dosya ileti başlığı, kaynaklı özet, açık görev ve profil adını içerebilir. Kullanıcı bu dosyayı haricî bir takvim servisine yüklerse o servisin gizlilik koşulları geçerli olur.
