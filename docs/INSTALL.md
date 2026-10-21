# Kurulum ve güncelleme

Eğitim Pusulası ön sürümü çalışma zamanı paketi indirmez ve yönetici yetkisi istemez. Node.js 24 veya üzeri kullanır; başka npm bağımlılığı yoktur.

## Windows

1. Node.js 24 veya üzerini [resmî Node.js indirme sayfasından](https://nodejs.org/en/download) kurun.
2. Eğitim Pusulası arşivini kişisel ve yazılabilir bir klasöre çıkarın. Ortak veya bulutla eşitlenen bir klasör çocuk verileri için önerilmez.
3. `Egitim-Pusulasi-Baslat.cmd` dosyasına çift tıklayın.
4. Komut penceresini açık bırakın. Uygulama hazır olduğunda `http://127.0.0.1:4173` tarayıcıda açılır.
5. İlk kurulum ekranındaki yerel veri ve isteğe bağlı AI açıklamasını okuyun; çocuk profili için gerçek ad yerine takma ad kullanabilirsiniz.
6. Durdurmak için komut penceresinde `Ctrl+C` kullanın ve sorulursa onaylayın.

Windows bilinmeyen bir `.cmd` dosyası için uyarı gösterebilir. Dosya düz metindir; çalıştırmadan önce içeriği bir metin düzenleyicisinde inceleyebilirsiniz. Proje PowerShell çalıştırma politikasını değiştirmez.

## macOS ve Linux

Terminalde proje klasörüne geçin ve:

```sh
sh start.sh
```

Durdurmak için `Ctrl+C` kullanın. Masaüstü ortamında tarayıcı otomatik açılamazsa terminalde gösterilen yerel adresi elle açın.

## Docker

Docker kullananlar proje klasöründe şu komutu çalıştırabilir:

```sh
docker compose up --build
```

Compose portu yalnızca `127.0.0.1` üzerinde yayımlar ve veriyi `egitim-pusulasi-data` adlı volume içinde tutar. Volume silinirse yerel okul verileri de silinir.

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
