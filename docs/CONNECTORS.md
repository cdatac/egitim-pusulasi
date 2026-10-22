# Bağlayıcı sözleşmesi

Eğitim Pusulası okul sistemlerini çekirdek uygulamadan ayırır. Bir bağlayıcı yalnızca salt okunur duyuru ve mesaj kayıtları üretir; parola, oturum çerezi veya erişim belirteci içe aktarma API'sine taşınmaz.

## Ortak kayıt

```json
{
  "externalId": "okul-sistemindeki-kararlı-kimlik",
  "kind": "announcement",
  "title": "Gezi duyurusu",
  "body": "Cuma günü müze gezisi yapılacaktır.",
  "sender": "Okul yönetimi",
  "occurredAt": "2026-10-21T10:00:00+03:00",
  "sourceUrl": "https://okul.example/duyuru?id=42"
}
```

`externalId` verilmezse içerikten kararlı bir SHA-256 kimliği türetilir. Böylece aynı ileti sonraki yenilemelerde tekrar eklenmez. `sourceUrl` içindeki kullanıcı bilgileri ve token/oturum benzeri sorgu parametreleri kaydedilmeden önce kaldırılır.

## Güvenlik sınırı

Sözleşme; `password`, `token`, `accessToken`, `refreshToken`, `cookie`, `authorization`, `session`, `secret` ve `apiKey` gibi alanları iç içe nesnelerde dahi reddeder. Bağlayıcının kimlik doğrulama uygulaması kendi dar kapsamlı çalışma alanında kalmalıdır.

## Yerel içe aktarma API'si

```http
POST /api/connectors/k12/import
Content-Type: application/json

{"profileId":1,"records":[...]}
```

`profileId`, kaydın hangi çocuk profiline ait olduğunu belirler ve mevcut bir profil olmalıdır. Aynı okul ileti kimliği farklı profillerde bağımsız olarak saklanabilir.

K12 tanımı `read-only` durumundadır. Duyuru ve mesaj çağrıları, kullanıcının kendi veli oturumunda çalışma zamanında doğrulanmıştır. Yerel eşitleme yalnızca `127.0.0.1:9222` adresinde kullanıcı tarafından açılmış Chrome penceresindeki `https://*.k12net.com` sekmesini kabul eder. Parola istenmez; çerez veya erişim belirteci veritabanına yazılmaz.

## Yerel Chrome oturumu ile eşitleme

K12, giriş yapıldıktan sonra mesaj listesini `/SPCore.Web/api/Messages/{enrollmentId}/Inbox`, ileti gövdesini ise `/SPCore.Web/api/Messages/Message/{messageId}` üzerinden okur. Eğitim Pusulası bu çağrıları kullanıcının açık tarayıcı oturumunda gerçekleştirir ve en fazla 250 kaydı ortak biçime dönüştürür.

1. Windows'ta `K12-Baglantisini-Ac.cmd`, macOS/Linux'ta `sh k12-baglantisini-ac.sh` ile yalnızca Eğitim Pusulası için ayrılmış Chrome penceresini açın. Başlatıcı denetim adresini `127.0.0.1:9222` ile sınırlar.
2. Bu pencerede kendi K12 veli hesabınıza giriş yapın.
3. Eğitim Pusulası'nda **Bağlantıyı kontrol et**, ardından **K12'den eşitle** düğmesini kullanın.

Eşitleme K12 sayfasını Mesajlar bölümüne götürür. Mesaj gönderme, silme, okundu işareti değiştirme, not/yoklama değiştirme veya başka bir hesaba erişme çağrısı yapmaz. Her eşitleme için kullanıcıdan ayrıca onay alınır.

Bu ilk ağ bağlayıcısı mesaj ve duyuruları kapsar. Not, devamsızlık, ödev, sınav ve diğer modüller çalışma zamanı kanıtlarıyla tek tek doğrulandıktan sonra aynı salt-okunur sınır içinde eklenecektir.

## K12 bildirim dışa aktarımı

Parola veya K12 oturumu taşımayan yardımcı araçlar, cihaz sahibinin dışa aktardığı bildirimleri şu yerel uç noktaya verebilir:

```http
POST /api/connectors/k12/notifications/import
Content-Type: application/json

{"profileId":1,"records":[{"title":"Sınav duyurusu","message":"Sınav cuma günü yapılacaktır.","receivedAt":"2026-10-21T12:00:00+03:00"}]}
```

`message` yoksa `body` kullanılır. Yalnızca başlık, ileti gövdesi, gönderen, alınma zamanı, güvenli kaynak URL'si ve isteğe bağlı dış kimlik ortak kayda aktarılır. Uygulama içi yönlendirme alanları (`intent`, `portal`, `query`) bilerek atılır. Bu giriş yolu K12'ye ağ isteği göndermez; Android bildirim erişimi isteyen gelecekteki yardımcı uygulama ayrıca açık kullanıcı izni istemelidir.

## Sentetik test örneği

`test/fixtures/k12-safe-sample.json` yalnızca uydurma kişi, okul, ileti ve `.invalid` alan adları içerir. Bağlayıcı geliştirenler gerçek çocuk verisini kaydetmeden duyuru, mesaj, URL temizleme ve tekrar ayıklama akışını bu dosyayla sınayabilir. Gerçek oturumdan alınan yanıt gövdeleri, ekran görüntüleri veya ağ kayıtları depoya eklenmemelidir.

## Temiz oda kuralı

Bağlayıcılar özel uygulama kaynak kodu veya varlıklarını kopyalamaz. Yalnızca kullanıcı tarafından yetkilendirilmiş çalışma zamanı davranışına, kamuya açık protokollere ve bu depodaki bağımsız uygulama koduna dayanır.
