# Eğitim Pusulası

K12 duyuru ve mesajlarını yerel olarak saklayan, özetleyen ve yapılacak iş/tarih çıkaran ebeveyn kontrollü prototip.

## Çalıştırma

Node.js 24 veya üzeri gerekir. Ek paket kurulumu yoktur.

### Windows — çift tıklama

1. Proje klasöründeki `Egitim-Pusulasi-Baslat.cmd` dosyasına çift tıklayın.
2. Başlatıcı ortamı denetler, yerel sunucuyu açar ve hazır olduğunda tarayıcıyı getirir.
3. İlk açılış ekranında yerel veri açıklamasını okuyup çocuk için bir ad veya takma ad seçin.
4. Uygulamayı durdurmak için açılan komut penceresinde `Ctrl+C` tuşlarına basın.

Başlatıcı İnternet'ten yazılım indirmez. Node.js eksikse yalnızca resmî indirme adresini gösterir.

Ayrıntılı kurulum, güncelleme, yedekleme ve kaldırma adımları için [kurulum belgesine](docs/INSTALL.md); günlük kullanım için [Türkçe kullanıcı rehberine](docs/USER_GUIDE.md) bakın.

### macOS veya Linux

```sh
sh start.sh
```

Tarayıcıyı otomatik açmadan başlatmak için `node scripts/launch.mjs --no-browser` kullanılabilir.

### Geliştirici kullanımı

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

Varsayılan durumda içerik bilgisayardan çıkmaz; yerel Türkçe kurallarla sınıflandırılır. Uzak yapay zekâ bağlantısı ayrıca ve yalnızca süreç ortamında yapılandırılır:

```powershell
$env:AI_API_URL="https://AI-SERVISI/v1/responses"
$env:AI_API_KEY="..."
$env:AI_MODEL="..."
npm start
```

API anahtarı veritabanına veya tarayıcıya yazılmaz. AI servisi etkin olsa bile içe aktarılan mesajlar otomatik gönderilmez. Her ileti için **AI ile analiz et** seçilir ve gönderim kapsamı onaylanır. E-posta ve telefon ifadeleri varsayılan olarak çağrıdan önce maskelenir.

Responses API biçimiyle uyumlu bir model servisi aynı bilgisayarda çalışıyorsa anahtar gerekmeksizin kullanılabilir:

```powershell
$env:AI_API_URL="http://127.0.0.1:11434/v1/responses"
$env:AI_MODEL="YEREL-MODEL-ADI"
$env:AI_API_KEY=""
npm start
```

Anahtarsız kullanım yalnızca `127.0.0.1`, `localhost` veya `::1` adreslerinde kabul edilir. Yerel model çağrılarında da görünür önizleme ve işlem başına onay korunur. Uzak bir URL için API anahtarı zorunludur.

## Mevcut kapsam

- Manuel duyuru/mesaj içe aktarma
- Yerel SQLite kayıt
- Kaynağı koruyan özet kartları
- Kategori, öncelik, tarih ve yapılacak iş çıkarma
- Arama
- Her çocuk profili için kaynağa bağlı bugün/son 7 gün özeti
- Ebeveyn kontrollü açık/tamamlandı görev takibi
- Açıkça yazılmış tam tarihler için standart `.ics` takvim dışa aktarımı
- JSON veri dışa aktarma
- Birden fazla çocuk için birbirinden yalıtılmış profiller
- Profil adını değiştirme ve profili tüm yerel verileriyle silme
- Tek iletiyi veya seçili profile ait tüm yerel veriyi silme
- İsteğe bağlı uzak AI veya anahtarsız geri-döngü yerel model bağlantısı
- Profil bazında, kullanıcı yönetimli ad ve özel ifade maskelemesi
- En fazla beş yerel kaynak seçen, açık onaylı ve kaynak kimlikli AI soru-cevap
- Yerel veri ve takma ad seçeneklerini açıklayan ilk kurulum ekranı

K12 otomatik bağlayıcısı, oturum açılmış ağ çağrıları doğrulandıktan sonra eklenecektir. Uygulama K12 parolasını saklamaz.

Bağlayıcıların veri ve güvenlik sözleşmesi için [docs/CONNECTORS.md](docs/CONNECTORS.md) belgesine bakın.

## Katkı ve güvenlik

Katkı süreci için [CONTRIBUTING.md](CONTRIBUTING.md), güvenlik bildirimi için [SECURITY.md](SECURITY.md), veri akışları ve kalan riskler için [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md) belgelerine bakın.

Sürüm paketleme ve GitHub yayın kapıları için [docs/RELEASE.md](docs/RELEASE.md) belgesine bakın. Lisans seçilmeden, gerçek depo güvenlik bağlantıları ayarlanmadan ve geçici güvenlik metni güncellenmeden sürüm iş akışı yayına izin vermez.

GitHub'a göndermeden önce çalışma ağacını ve tüm Git geçmişini özel dosya ve yüksek güvenli kimlik bilgisi kalıplarına karşı denetleyin:

```powershell
npm run audit:release
```
