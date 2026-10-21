# Eğitim Pusulası

K12 duyuru ve mesajlarını yerel olarak saklayan, özetleyen ve yapılacak iş/tarih çıkaran ebeveyn kontrollü prototip.

## Çalıştırma

Node.js 24 veya üzeri gerekir. Ek paket kurulumu yoktur.

```powershell
npm start
```

Ardından `http://127.0.0.1:4173` adresini açın.

Başlangıç koşullarını yalnızca denetlemek için:

```powershell
npm run doctor
```

### Docker ile

Docker Desktop veya Docker Engine kuruluysa:

```powershell
docker compose up --build
```

Ardından yine `http://127.0.0.1:4173` adresini açın. Compose yapılandırması portu yalnızca localhost'a bağlar ve verileri adlandırılmış bir Docker volume içinde tutar.

Varsayılan durumda içerik bilgisayardan çıkmaz; yerel Türkçe kurallarla sınıflandırılır. Yapay zekâ bağlantısı ayrıca ve yalnızca süreç ortamında yapılandırılır:

```powershell
$env:AI_API_URL="https://AI-SERVISI/v1/responses"
$env:AI_API_KEY="..."
$env:AI_MODEL="..."
npm start
```

API anahtarı veritabanına veya tarayıcıya yazılmaz. AI servisi etkin olsa bile içe aktarılan mesajlar otomatik gönderilmez. Her ileti için **AI ile analiz et** seçilir ve gönderim kapsamı onaylanır. E-posta ve telefon ifadeleri varsayılan olarak çağrıdan önce maskelenir.

## Mevcut kapsam

- Manuel duyuru/mesaj içe aktarma
- Yerel SQLite kayıt
- Kaynağı koruyan özet kartları
- Kategori, öncelik, tarih ve yapılacak iş çıkarma
- Arama
- JSON veri dışa aktarma
- Tek iletiyi veya tüm yerel veriyi silme
- İsteğe bağlı AI servis bağlantısı

K12 otomatik bağlayıcısı, oturum açılmış ağ çağrıları doğrulandıktan sonra eklenecektir. Uygulama K12 parolasını saklamaz.

Bağlayıcıların veri ve güvenlik sözleşmesi için [docs/CONNECTORS.md](docs/CONNECTORS.md) belgesine bakın.
