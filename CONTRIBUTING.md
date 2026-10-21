# Katkı rehberi

Eğitim Pusulası çocukların okul verileriyle çalıştığı için küçük bir değişiklikte dahi gizlilik ve kaynak izlenebilirliği işlev kadar önemlidir.

## Başlamadan önce

- Hata kaydında, testte veya ekran görüntüsünde gerçek öğrenci adı, okul mesajı, parola, oturum bilgisi ya da API anahtarı kullanmayın.
- Yeni bir okul sistemi entegrasyonu salt okunur bağlayıcı sözleşmesini izlemelidir.
- Özel uygulama kodunu, görselini veya APK içeriğini kopyalamayın. Yalnızca kamuya açık bilgi, yetkili çalışma zamanı gözlemi ve sentetik test verisi kullanın.
- Büyük özelliklerde önce kapsamı ve gizlilik etkisini bir issue içinde tartışın.

## Yerel geliştirme

Node.js 24 veya üzeri gerekir; çalışma zamanı bağımlılığı yoktur.

```powershell
npm run doctor
npm run check
npm test
npm run audit:release
```

Değişiklik sonrasında uygulamayı `npm start` ile açın ve ilgili kullanıcı akışını tarayıcıda doğrulayın.

## Değişiklik ölçütleri

Bir pull request:

1. Amacı ve kullanıcıya etkisini açıklar.
2. Yeni davranış için otomatik test ekler veya neden eklenemediğini belirtir.
3. Veri toplama, saklama, silme ve dış servise gönderme etkisini açıklar.
4. Kaynak ileti ile üretilen analiz arasındaki bağı korur.
5. Parola, token, çerez, gerçek okul verisi veya tersine mühendislik çıktısı içermez.
6. İlgili kullanıcı ve güvenlik belgelerini günceller.

## Güvenlik sorunları

Çocuk veya aile verisini etkileyen açıkları herkese açık issue olarak bildirmeyin. [SECURITY.md](SECURITY.md) içindeki özel bildirim sürecini kullanın.

Katkı göndererek [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) içindeki topluluk kurallarına uymayı kabul etmiş olursunuz.
