# Eğitim Pusulası

K12 duyuru ve mesajlarını yerel olarak saklayan, özetleyen ve yapılacak iş/tarih çıkaran ebeveyn kontrollü prototip.

## Çalıştırma

Node.js 24 veya üzeri gerekir. Ek paket kurulumu yoktur.

```powershell
npm start
```

Ardından `http://127.0.0.1:4173` adresini açın.

Varsayılan durumda içerik bilgisayardan çıkmaz; yerel Türkçe kurallarla sınıflandırılır. Yapay zekâ bağlantısı ayrıca ve yalnızca süreç ortamında yapılandırılır:

```powershell
$env:AI_API_URL="https://AI-SERVISI/v1/responses"
$env:AI_API_KEY="..."
$env:AI_MODEL="..."
npm start
```

API anahtarı veritabanına veya tarayıcıya yazılmaz. AI servisi etkinleştirildiğinde eklenen mesaj içeriği analiz için o servise gönderilir.

## Mevcut kapsam

- Manuel duyuru/mesaj içe aktarma
- Yerel SQLite kayıt
- Kaynağı koruyan özet kartları
- Kategori, öncelik, tarih ve yapılacak iş çıkarma
- Arama
- İsteğe bağlı AI servis bağlantısı

K12 otomatik bağlayıcısı, oturum açılmış ağ çağrıları doğrulandıktan sonra eklenecektir. Uygulama K12 parolasını saklamaz.
