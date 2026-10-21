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

Mevcut K12 tanımı `read-only` durumundadır. Ağ uygulaması, kullanıcının kendi oturumunda duyuru ve mesaj çağrıları çalışma zamanında doğrulanana kadar bilinçli olarak etkin değildir.

## Sentetik test örneği

`test/fixtures/k12-safe-sample.json` yalnızca uydurma kişi, okul, ileti ve `.invalid` alan adları içerir. Bağlayıcı geliştirenler gerçek çocuk verisini kaydetmeden duyuru, mesaj, URL temizleme ve tekrar ayıklama akışını bu dosyayla sınayabilir. Gerçek oturumdan alınan yanıt gövdeleri, ekran görüntüleri veya ağ kayıtları depoya eklenmemelidir.

## Temiz oda kuralı

Bağlayıcılar özel uygulama kaynak kodu veya varlıklarını kopyalamaz. Yalnızca kullanıcı tarafından yetkilendirilmiş çalışma zamanı davranışına, kamuya açık protokollere ve bu depodaki bağımsız uygulama koduna dayanır.
