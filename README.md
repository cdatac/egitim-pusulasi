# Eğitim Pusulası

K12 duyuru ve mesajlarını yerel olarak saklayan, özetleyen ve yapılacak iş/tarih çıkaran ebeveyn kontrollü uygulama.

Bu bağımsız ve açık kaynak bir topluluk projesidir; K12 veya okulunuzla resmî bağlantısı yoktur ve okulun resmî kayıtlarının yerine geçmez.

## Çalıştırma

Node.js 24 veya üzeri gerekir. Ek paket kurulumu yoktur.

### Windows — çift tıklama

1. Proje klasöründeki `Egitim-Pusulasi-Baslat.cmd` dosyasına çift tıklayın.
2. Başlatıcı ortamı denetler, yerel sunucuyu açar ve hazır olduğunda tarayıcıyı getirir.
3. İlk açılış ekranında yerel veri açıklamasını okuyup çocuk için bir ad veya takma ad seçin.
4. Uygulamayı durdurmak için açılan komut penceresinde `Ctrl+C` tuşlarına basın.

Başlatıcı İnternet'ten yazılım indirmez. Node.js eksikse yalnızca resmî indirme adresini gösterir.

Ayrıntılı kurulum, güncelleme, yedekleme ve kaldırma adımları için [kurulum belgesine](docs/INSTALL.md); günlük kullanım için [Türkçe kullanıcı rehberine](docs/USER_GUIDE.md) bakın.

### K12'den otomatik eşitleme

1. Windows'ta `K12-Baglantisini-Ac.cmd` dosyasına çift tıklayın. macOS'ta `K12-Baglantisini-Ac.command` dosyasını, Linux'ta `sh k12-baglantisini-ac.sh` komutunu kullanın.
2. Açılan ayrı Chrome penceresinde K12 veli hesabınıza giriş yapın.
3. Eğitim Pusulası'nda doğru çocuk profilini seçip **Bağlantıyı kontrol et**, ardından **K12'den eşitle** düğmesine basın.

Bu pencere rastgele bir localhost portu ve geçici gizli Chrome profili kullanır. Başlatıcı penceresini Chrome kapanana kadar açık bırakın; Chrome kapanınca geçici profil silinir. Parolayı Chrome'a kaydetmeyin. Ayrıntılı adımlar [kullanım kılavuzundadır](docs/USER_GUIDE.md#3-k12-bağlantısı-ve-eşitleme).

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

Hostta `4173` kullanımdaysa `APP_PORT` değişkeniyle farklı bir localhost portu seçilebilir; konteyner içi port ve güvenli bağlama değişmez.

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
- Parola veya oturum bilgisi taşımayan K12 bildirim JSON dosyasını seçili çocuk profiline aktarma
- Ayrılmış yerel Chrome oturumundan K12 mesaj ve duyurularını onaylı, salt-okunur eşitleme
- Haftanın konu/kazanım iletilerini ders bazında haritalama ve ödevlerle kaynaklı karşılaştırma
- Tamamlanabilir haftalık kontrol listesi ile etkinlik ve görevleri birleştiren `.ics` takvim dışa aktarımı
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

K12 mesaj ve duyuru çağrıları kullanıcıya ait veli oturumunda deneysel olarak doğrulanmıştır. Başlatıcı her çalıştırmada rastgele bir `127.0.0.1` portu ve geçici gizli Chrome profili oluşturur; parola, çerez veya token Eğitim Pusulası veritabanına kaydedilmez. Eşitleme K12'ye yazma isteği göndermez; ancak ileti ayrıntısının açılması K12 tarafından “okundu” olarak değerlendirilebilir. İlk eşitlemede K12'de seçili öğrenci, açık onayla Eğitim Pusulası profiline bağlanır. Not, devamsızlık, K12 Ödev ve sınav modülleri henüz otomatik eşitlemeye dahil değildir.

Bağlayıcıların veri ve güvenlik sözleşmesi için [docs/CONNECTORS.md](docs/CONNECTORS.md) belgesine bakın.

## Katkı ve güvenlik

Katkı süreci için [CONTRIBUTING.md](CONTRIBUTING.md), güvenlik bildirimi için [SECURITY.md](SECURITY.md), veri akışları ve kalan riskler için [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md) belgelerine bakın.

Sürüm paketleme ve GitHub yayın kapıları için [docs/RELEASE.md](docs/RELEASE.md) belgesine bakın. Lisans veya gerçek depo güvenlik bağlantıları eksikse sürüm iş akışı yayına izin vermez.

GitHub'a göndermeden önce çalışma ağacını ve tüm Git geçmişini özel dosya ve yüksek güvenli kimlik bilgisi kalıplarına karşı denetleyin:

```powershell
npm run audit:release
```

## Lisans

Eğitim Pusulası, [GNU Affero General Public License v3.0](LICENSE) koşullarıyla ücretsiz ve açık kaynak olarak sunulur (`AGPL-3.0-only`).
