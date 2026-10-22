# Gizlilik yaklaşımı

Eğitim Pusulası çocukların okul verileriyle çalışır. Bu nedenle veri minimizasyonu ürünün temel şartıdır.

## Varsayılan davranış

- Uygulama yalnızca kullanıcının bilgisayarında `127.0.0.1` üzerinden çalışır.
- Mesajlar, kullanıcının verdiği çocuk profil adları ve ebeveynin işaretlediği görev durumları yerel SQLite veritabanında saklanır.
- Her profilin iletileri, panosu, dışa aktarımı ve silme işlemleri birbirinden ayrıdır.
- Yerel sınıflandırma kullanıldığında mesajlar üçüncü tarafa gönderilmez.
- K12 parolası bu prototip tarafından saklanmaz.

## K12 yerel Chrome eşitlemesi

Kullanıcı her çalıştırmada onay verirse uygulama, yalnızca `127.0.0.1:9222` üzerinde kullanıcı tarafından açılmış Chrome penceresindeki giriş yapılmış `https://*.k12net.com` sekmesine bağlanır. Mesaj ve duyurular açık veli oturumunda salt okunur çağrılarla alınır. Parola istenmez; Chrome çerezleri, istek başlıkları ve erişim belirteçleri veritabanına veya dışa aktarıma yazılmaz. İleti başlığı, gövdesi, göndereni, tarihi, türü ve K12 ileti kimliği seçili çocuk profilinde yerel olarak saklanır.

Chrome uzaktan hata ayıklama arabirimi güçlü bir yerel yetkidir. Bu nedenle yalnızca Eğitim Pusulası için ayrılmış bir Chrome profili kullanın, bağlantı noktasını ağdaki başka cihazlara açmayın ve eşitleme bittikten sonra ayrılmış pencereyi kapatın.
- İlk kurulum ekranı bu sınırları gösterir ve gerçek çocuk adı yerine takma ad kullanılmasını önerir.

## K12 bildirim dosyaları

Kullanıcı uyumlu bir bildirim JSON dosyasını kendisi seçerse yalnızca ileti başlığı, `message`/`body` gövdesi, isteğe bağlı gönderen, alınma zamanı, güvenli kaynak URL'si ve dış kimlik yerel kayda dönüştürülür. K12'nin uygulama içi `intent`, `portal` ve `query` yönlendirme alanları atılır. Parola, token, oturum, çerez veya yetkilendirme alanı bulunan kayıtlar tümüyle reddedilir.

Bu içe aktarma işlemi K12'ye ağ isteği göndermez. Seçilen dosya tarayıcıdan yalnızca aynı bilgisayardaki Eğitim Pusulası sunucusuna aktarılır ve seçili çocuk profilinde saklanır.

## İsteğe bağlı AI servisi

Kullanıcı `AI_API_URL` ve `AI_MODEL` değişkenlerini, uzak servis için ayrıca `AI_API_KEY` değerini kendisi ayarlasa bile içerik otomatik gönderilmez. Her ileti için ayrı **AI ile analiz et** işlemi ve gönderim onayı gerekir. Onay verilirse mesaj başlığı, gönderen, tarih ve gövde seçilen AI servisine analiz için gönderilir. Profil adı gönderilmez. E-posta ve telefon ifadeleri varsayılan olarak maskelenir. Ebeveyn ayrıca her profil için ad, öğretmen veya okul adı gibi özel ifadeler tanımlayabilir; bunların metindeki eşleşmeleri de çağrıdan önce maskelenir. API anahtarı tarayıcıya veya veritabanına yazılmaz.

`127.0.0.1`, `localhost` veya `::1` üzerindeki Responses-uyumlu bir yerel model servisi API anahtarı olmadan kullanılabilir. Bu durumda istek aynı bilgisayarın geri-döngü ağına gider; yine de yerel servis kendi günlükleme ve saklama ayarlarına sahip olabileceğinden önizleme, maskeleme ve işlem başına onay kaldırılmaz. Geri-döngü dışındaki tüm AI adreslerinde API anahtarı zorunludur ve içerik seçilen üçüncü tarafın gizlilik koşullarına tabi olur.

Arayüz, gönderilecek alanları, yaklaşık karakter sayısını, maskeleme durumunu ve etkin özel ifade sayısını çağrıdan önce gösterir. Özel maskeleme listesi yalnızca yerel veritabanında tutulur ve AI servisine liste olarak gönderilmez; yalnızca maskelenmiş metin gönderilir.

Kaynaklı soru-cevapta ilgili iletiler önce cihazda seçilir ve en fazla beş ileti kullanılır. Soru, seçilen ileti başlıkları, gönderilecek alanlar ve yaklaşık karakter sayısı kullanıcıya gösterilir. Onaylanan kaynak kimlikleri isteğe sabitlenir ve aynı çocuk profiline ait oldukları sunucuda yeniden doğrulanır. Ayrı onay verilmeden soru veya kaynak içerikleri AI servisine gönderilmez. AI tarafından döndürülen kaynak kimlikleri, yalnızca gerçekten gönderilen iletilerin kimlikleriyle sınırlandırılır.

## Toplanmayan veriler

Proje telemetri, reklam tanımlayıcısı veya davranışsal profil toplamaz. Proje geliştiricileri kullanıcının yerel veritabanına erişemez.

## Kullanıcının kontrolü

Mevcut sürüm; profilleriyle birlikte JSON veri dışa aktarma, seçili iletiyi silme, seçili profile ait iletilerle analizleri temizleme ve bir profili iletileri, analizleri, görev durumları ve maskeleme ifadeleriyle birlikte kaldırma işlevleri sunar. Son profil kaldırıldığında yerel profil sıfırlanır ve ilk kurulum yeniden açılır.

Takvim dışa aktarımı yalnızca kullanıcının düğmeye basmasıyla yerel bir `.ics` dosyası oluşturur. Dosya ileti başlığı, kaynaklı özet, açık görev ve profil adını içerebilir. Kullanıcı bu dosyayı haricî bir takvim servisine yüklerse o servisin gizlilik koşulları geçerli olur.
