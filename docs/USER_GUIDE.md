# Eğitim Pusulası kullanım kılavuzu

Eğitim Pusulası, K12 mesaj ve duyurularını ebeveynin bilgisayarında düzenler; haftalık kazanımları, ödevleri, etkinlikleri ve yapılacakları tek yerde gösterir. Okulun resmî kaydının yerine geçmez. Önemli tarih, ödeme, devamsızlık ve güvenlik konularında özgün iletiyi mutlaka kontrol edin.

## 1. Başlatma ve ilk kurulum

Windows'ta `Egitim-Pusulasi-Baslat.cmd` dosyasına çift tıklayın. macOS veya Linux'ta proje klasöründe `sh start.sh` çalıştırın. Uygulama `http://127.0.0.1:4173` adresinde açılır; bu adres yalnızca aynı bilgisayardan erişilen yerel uygulamadır.

İlk açılışta:

1. Yerel veri ve isteğe bağlı AI açıklamasını okuyun.
2. Çocuk için bir ad veya mahremiyeti artırmak için takma ad yazın.
3. Gizlilik açıklamasını onaylayıp kurulumu tamamlayın.

Kurulum, güncelleme ve kaldırma ayrıntıları [kurulum belgesindedir](INSTALL.md).

## 2. Ekranı tanıma

Üstte etkin çocuk profili, ileti sayıları ve **K12'den eşitle** alanı bulunur. Altındaki beş sekme günlük işleri ayırır:

- **Bugün:** Bugünün veya son yedi günün kaynaklı özeti ve açık görevleri.
- **Haftam:** Ders bazlı kazanım haritası, ödev kontrol listesi ve etkinlikler.
- **İletiler:** Arama, özgün okul iletileri, görev kutuları ve takvim/veri dışa aktarımı.
- **Asistan:** Yalnızca onay verdiğiniz kaynaklarla isteğe bağlı AI soru-cevap.
- **Ayarlar:** Profil yönetimi, manuel içe aktarma ve AI maskeleme listesi.

Sekme seçiminiz bu tarayıcıda hatırlanır. Kaynak bağlantısına bastığınızda uygulama ilgili özgün iletiyi **İletiler** sekmesinde açar.

## 3. K12 bağlantısı ve eşitleme

K12 parolası Eğitim Pusulası'na yazılmaz. Giriş, uygulamadan ayrı açılan Chrome penceresinde yapılır.

### Windows

1. `K12-Baglantisini-Ac.cmd` dosyasına çift tıklayın.
2. Açılan ayrı Chrome penceresinde kendi K12 veli hesabınıza giriş yapın.
3. Eğitim Pusulası'na dönüp **Bağlantıyı kontrol et** düğmesine basın.
4. Doğru çocuk profili seçiliyken **K12'den eşitle** düğmesine basın.
5. Gösterilen onayı okuyup eşitlemeyi kabul edin.

### macOS veya Linux

Proje klasöründe `sh k12-baglantisini-ac.sh` çalıştırın; sonra yukarıdaki 2-5. adımları izleyin.

Bağlantı penceresi ayrı bir Chrome profili kullanır. Parola, çerez ve erişim belirteci Eğitim Pusulası veritabanına kaydedilmez. Eşitleme en fazla 250 mesaj/duyuru okur, daha önce alınanları tekrar eklemez ve K12'ye mesaj göndermez veya kayıt değiştirmez. İlk sürümde otomatik bağlantı yalnızca mesaj ve duyuruları kapsar.

K12 pencereniz okulunuza özel bir adrese gitmiyorsa o ayrı Chrome penceresinde okulunuzun verdiği K12 adresini açın. Adres `https://` kullanmalı ve `k12net.com` alanında olmalıdır.

## 4. Haftalık kazanım ve ödev takibi

**Haftam** sekmesinde bir tarih seçildiğinde o tarihin pazartesi-pazar haftası gösterilir. Uygulama:

- okulun açıkça yazdığı konu ve kazanımları derslere ayırır,
- ödev ve yapılacakları kontrol listesine dönüştürür,
- ödevi aynı haftadaki kazanımlarla metin benzerliğine göre karşılaştırır,
- düşük güvenli veya eşleşmeyen maddeleri **kontrol edilmeli** olarak bırakır,
- etkinlikleri aynı haftalık görünümde toplar.

Uygulama okul iletisinde bulunmayan müfredat kazanımı üretmez. Ödev kutusunu işaretlediğinizde aynı görev diğer ekranlarda da tamamlanmış görünür.

**Haftalık planı indir** düğmesi etkinlikleri takvim olayı (`VEVENT`), ödev ve yapılacakları kontrol edilebilir görev (`VTODO`) olarak tek `.ics` dosyasına aktarır. Dosyayı Google Takvim, Apple Takvim veya Outlook gibi uyumlu bir takvime içe aktarabilirsiniz.

## 5. Çocuk profilleri

Üstteki seçiciden çocuklar arasında geçiş yapın. **Profil ayarları** veya **Ayarlar** sekmesinden yeni profil ekleyebilir, adını değiştirebilir ya da seçili profili silebilirsiniz.

Her profilin iletileri, görev durumları, özetleri ve özel maskeleme ifadeleri ayrıdır. Profil silme geri alınamaz; gerekiyorsa önce **İletiler > Veriyi indir** ile yedek alın.

## 6. Özetler, arama ve görevler

**Bugün** sekmesinde dönem seçicisiyle bugünü veya son yedi günü görün. Sayılar ve maddeler yalnızca seçili profile aittir; her madde özgün iletiye bağlanır.

**İletiler** sekmesindeki arama başlık ve gövdede çalışır. Bir görevi yaptığınızda kutusunu işaretleyin. Bu işaret yalnızca yerel veritabanında tutulur; okul sistemine hiçbir işlem gönderilmez.

Genel **Takvimi indir** düğmesi yalnızca iletide açıkça yazılmış, yılı bulunan tam tarihleri `.ics` dosyasına koyar. Sistem tahminî tarih üretmez.

## 7. Manuel ileti veya bildirim dosyası ekleme

K12 eşitlemesi kullanılamıyorsa **Ayarlar** sekmesinden manuel içerik eklenebilir. İlk satır başlık, devamındaki satırlar gövdedir. Birden çok iletiyi yalnızca `---` yazan bir satırla ayırın.

Parola veya oturum bilgisi içermeyen uyumlu bir K12 bildirim dışa aktarımı için **Bildirim dosyası seç (.json)** düğmesini kullanabilirsiniz. Dosya en fazla 1 MB ve 250 kayıt olabilir. Doğru çocuk profilinin seçili olduğunu kontrol edin.

## 8. AI seçenekleri ve onay

Varsayılan yerel kural analizi hiçbir AI servisine bağlanmaz. İsteğe bağlı bir yerel model veya uzak AI servisi yapılandırılabilir. AI açık olsa bile içerik otomatik gönderilmez.

Her ileti analizi ve her soru için uygulama gönderilecek alanları ve yaklaşık boyutu gösterir. E-posta, telefon ve sizin eklediğiniz özel ifadeler varsayılan olarak maskelenir. İstek yalnızca açık onayınızdan sonra yapılır.

**Asistan** sekmesi ilgili kaynakları önce bilgisayarda seçer, en fazla beş ileti gönderir ve yanıtın kaynaklarını gerçekten gönderilen kayıtlarla sınırlar. AI yanıtları hata yapabilir; özgün iletiyle doğrulayın.

## 9. Veriyi indirme ve silme

**İletiler > Veriyi indir**, profilleri, iletileri, analizleri ve yerel ayarları JSON dosyasına aktarır. Bu dosya gerçek okul verisi içerebilir; ortak veya bulutla eşitlenen klasörlerde bırakmayın.

Arayüzden tek iletiyi, seçili profilin iletilerini veya profili ilişkili verileriyle silebilirsiniz. Son profil silinirse ilk kurulum yeniden açılır. Uygulama çalışırken `data` klasörünü elle kopyalamayın; önce uygulamayı durdurun.

## 10. Güvenli kullanım

- Uygulamayı İnternet'e veya yerel ağ arayüzüne açmayın.
- K12 parolasını, çerezini veya API anahtarını ileti alanına yapıştırmayın.
- Gerçek çocuk verisini GitHub issue, ekran görüntüsü veya hata kaydında paylaşmayın.
- Ortak bilgisayarda işletim sistemi hesabını kilitleyin.
- Acil veya hukuki sonuç doğuran konuda okulun özgün iletisini ve resmî kanalını kullanın.

Güvenlik sorunu bulursanız gerçek çocuk verisi kullanmadan [güvenlik politikasındaki](../SECURITY.md) özel bildirim yolunu izleyin.

## 11. Sorun giderme

- **Uygulama açılmıyor:** Proje klasöründe `npm run doctor` çalıştırın. Node.js 24 veya üzeri gerekir.
- **K12 bağlantısı bulunamıyor:** `K12-Baglantisini-Ac.cmd`/`.sh` ile açılan ayrı Chrome penceresinin açık ve veli hesabının giriş yapmış olduğunu kontrol edin. Normal Chrome pencereniz bağlantı için yeterli değildir.
- **Chrome bulunamadı:** Google Chrome'u kurun. Windows'ta standart kurulum yolları otomatik aranır.
- **Eşitle düğmesi pasif:** Önce **Bağlantıyı kontrol et** düğmesine basın.
- **Oturum sona erdi:** Ayrı K12 Chrome penceresinde yeniden giriş yapın ve bağlantıyı tekrar kontrol edin.
- **İleti sayısı değişmedi:** Aynı kayıtlar kimliklerine göre tekrar eklenmez. Yeni iletinin K12 Mesajlar/Duyurular bölümünde bulunduğunu kontrol edin.
- **AI düğmesi görünmüyor:** AI yapılandırması kapalıdır; yerel analiz çalışmaya devam eder.
- **Port kullanımda:** `PORT` değerini değiştirin veya eski Eğitim Pusulası sürecini kapatın.

Teknik hata bildirirken uygulama sürümünü, işletim sistemini ve sentetik yeniden üretim adımlarını yazın; gerçek mesaj, öğrenci adı, parola veya ekran görüntüsü eklemeyin.
