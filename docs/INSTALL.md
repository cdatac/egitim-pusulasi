# Kurulum ve güncelleme

Eğitim Pusulası ön sürümü çalışma zamanı paketi indirmez ve yönetici yetkisi istemez. Node.js 24 veya üzeri kullanır; başka npm bağımlılığı yoktur.

GitHub'daki **Portable packages** iş akışı Windows, Linux ve macOS için Node çalışma zamanını içeren deneme paketleri üretir. Bu paketler ayrıca Node.js kurulumu istemez; ancak henüz kod imzalı olmadıkları için genel sürüm dosyası olarak yayımlanmaz. Her paket eşleşen Node lisansını ve çalışma zamanı özetini içerir. İmzalı resmî paketler yayınlandığında bu bölüm indirme bağlantılarıyla güncellenecektir.

İş akışı proje lisansı seçilmeden dağıtılabilir paket üretmeyi reddeder. Yerel geliştirme duman testi için paket oluşturucuya çıktı dizini, Node ikilisi ve o Node sürümünün lisans dosyası açıkça verilir:

```powershell
npm run build:portable -- --output=tmp/portable --node="C:\Program Files\nodejs\node.exe" --node-license="C:\YOL\NODE-LICENSE"
```

Oluşturucu mevcut bir çıktı dizininin üzerine yazmaz; `data/`, Git geçmişi ve geliştirme çalışma dosyaları açık dosya listesine dahil değildir.

## Windows

1. Node.js 24 veya üzerini [resmî Node.js indirme sayfasından](https://nodejs.org/en/download) kurun.
2. Eğitim Pusulası arşivini kişisel ve yazılabilir bir klasöre çıkarın. Ortak veya bulutla eşitlenen bir klasör çocuk verileri için önerilmez.
3. `Egitim-Pusulasi-Baslat.cmd` dosyasına çift tıklayın.
4. Komut penceresini açık bırakın. Uygulama hazır olduğunda `http://127.0.0.1:4173` tarayıcıda açılır.
5. İlk kurulum ekranındaki yerel veri ve isteğe bağlı AI açıklamasını okuyun; çocuk profili için gerçek ad yerine takma ad kullanabilirsiniz.
6. Durdurmak için komut penceresinde `Ctrl+C` kullanın ve sorulursa onaylayın.

Windows bilinmeyen bir `.cmd` dosyası için uyarı gösterebilir. Dosya düz metindir; çalıştırmadan önce içeriği bir metin düzenleyicisinde inceleyebilirsiniz. Proje PowerShell çalıştırma politikasını değiştirmez.

K12 eşitlemesi için ayrıca `K12-Baglantisini-Ac.cmd` dosyasına çift tıklayın. Bu başlatıcı Google Chrome'u yalnızca localhost üzerinden denetlenebilen, uygulamaya ayrılmış ayrı bir profille açar. Veli girişi bu pencerede yapılır; uygulama parolayı almaz. Ayrıntılar [kullanım kılavuzundadır](USER_GUIDE.md#3-k12-bağlantısı-ve-eşitleme).

## macOS ve Linux

Terminalde proje klasörüne geçin ve:

```sh
sh start.sh
```

Durdurmak için `Ctrl+C` kullanın. Masaüstü ortamında tarayıcı otomatik açılamazsa terminalde gösterilen yerel adresi elle açın.

K12 bağlantı penceresini açmak için ayrı bir terminalde `sh k12-baglantisini-ac.sh` çalıştırın.

## Docker

Docker kullananlar proje klasöründe şu komutu çalıştırabilir:

```sh
docker compose up --build
```

Compose bu değeri konteynere `PUBLIC_PORT` olarak aktarır; böylece Host ve Origin doğrulaması yalnızca seçilen dış localhost portunu da kabul eder.

Konteyner `node` kullanıcısıyla, salt-okunur kök dosya sistemiyle, düşürülmüş Linux yetenekleriyle ve süreç sayısı sınırıyla çalışır. Kalıcı yazma yalnızca `/data` volume'üne, geçici yazma sınırlı `/tmp` alanına yapılır. İmaj yerleşik sağlık kontrolü içerir.

Compose portu yalnızca `127.0.0.1` üzerinde yayımlar ve veriyi `egitim-pusulasi-data` adlı volume içinde tutar. Volume silinirse yerel okul verileri de silinir.

`4173` doluysa yalnızca localhost üzerinde farklı bir port seçilebilir:

```powershell
$env:APP_PORT="4273"
docker compose up --build
```

## Veriler ve yedekleme

Doğrudan Node.js çalıştırmasında veriler proje içindeki `data/egitim-pusulasi.db` dosyasındadır. Uygulama çalışırken bu dosyayı elle kopyalamayın; önce uygulamayı durdurun. Arayüzdeki **Veriyi indir** düğmesi taşınabilir JSON kopyası oluşturur.

JSON veya `.ics` dosyaları gerçek okul içeriği barındırabilir. Bunları e-posta, ortak disk veya bulut takvimine koymadan önce ilgili hizmetin gizlilik koşullarını değerlendirin.

## Güncelleme

1. Uygulamayı durdurun.
2. `data` klasörünün güvenli bir kopyasını alın.
3. Yeni sürüm dosyalarını indirin.
4. Eski `data` klasörünü yeni sürüm klasörüne taşıyın veya `DATA_DIR` ile aynı veri klasörünü seçin.
5. Başlatıcıyı çalıştırın. Veritabanı geçişleri başlangıçta otomatik uygulanır.

Sürüm düşürmeden önce mutlaka yedek alın; yeni şemayla yazılmış veritabanı eski sürümle uyumlu olmayabilir.

## Kaldırma

Uygulamayı durdurup proje klasörünü silmek programı kaldırır. Yerel okul verilerini korumak istiyorsanız önce JSON dışa aktarımı veya `data` klasörü yedeği alın. Docker kurulumunda uygulama klasörünü silmek volume verisini silmez; volume yönetimini ayrıca Docker üzerinden yapın.

## Sorun giderme

Ortam denetimi:

```sh
npm run doctor
```

Tarayıcıyı otomatik açmadan çalışma:

```sh
node scripts/launch.mjs --no-browser
```

`4173` portu kullanımda ise uygulamayı farklı bir portta başlatabilirsiniz:

```powershell
$env:PORT="4312"
node scripts/launch.mjs
```

Uygulamayı İnternet'e açık bir sunucuya veya yerel ağ arayüzüne bağlamayın; ön sürümde kullanıcı kimlik doğrulaması yoktur.
