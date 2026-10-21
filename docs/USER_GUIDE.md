# Eğitim Pusulası kullanıcı rehberi

Eğitim Pusulası, okul duyuru ve mesajlarını ebeveynin kendi bilgisayarında düzenlemeye yardımcı olur. Okulun resmî kaydının yerine geçmez; önemli tarih, ödeme, devamsızlık ve güvenlik konularında özgün iletiyi mutlaka kontrol edin.

## 1. Başlatma ve ilk kurulum

Windows'ta `Egitim-Pusulasi-Baslat.cmd` dosyasına çift tıklayın. macOS veya Linux'ta proje klasöründe `sh start.sh` çalıştırın. Ayrıntılı kurulum, güncelleme ve kaldırma adımları [kurulum rehberindedir](INSTALL.md).

Uygulama tarayıcıda `http://127.0.0.1:4173` adresini açar. Bu adres yalnızca aynı bilgisayardan erişilen yerel uygulamadır. İlk ekranda:

1. Yerel veri ve isteğe bağlı AI açıklamasını okuyun.
2. Çocuk için gerçek ad yerine isterseniz bir takma ad yazın.
3. Gizlilik açıklamasını onaylayıp kurulumu tamamlayın.

## 2. Duyuru veya mesaj ekleme

K12 otomatik bağlayıcısı gerçek oturum çağrıları doğrulanana kadar kapalıdır. Bu sürümde **Örnek doldur** düğmesiyle biçimi görebilir veya okul iletisini elle ekleyebilirsiniz.

- İlk satır başlıktır.
- Devamındaki satırlar ileti gövdesidir.
- Birden çok iletiyi `---` satırıyla ayırabilirsiniz.
- İçe aktarmadan önce metinde doğru çocuğa ait bilgi bulunduğunu kontrol edin.

Parola ve oturum bilgisi içermeyen uyumlu bir K12 bildirim dışa aktarımınız varsa **Bildirim dosyası seç (.json)** düğmesini kullanabilirsiniz. Dosya en fazla 1 MB ve en fazla 250 bildirim içerebilir. Uygulama `title`, `message`/`body`, gönderen ve alınma zamanını işler; K12'nin uygulama içi yönlendirme alanlarını saklamaz. Dosyayı seçmeden önce doğru çocuk profilinin etkin olduğundan emin olun.

Eklenen içerik hemen yerel kurallarla sınıflandırılır. Özgün metin kartın içinde korunur; özetin hatalı göründüğü durumlarda kaynak metni esas alın.

## 3. Çocuk profilleri

Üst bölümdeki profil seçicisiyle çocuklar arasında geçiş yapabilirsiniz. Profil yönetiminden:

- yeni bir profil ekleyebilir,
- profil adını veya takma adını değiştirebilir,
- seçili profili tüm iletileri ve ayarlarıyla silebilirsiniz.

Her profilin iletileri, görev durumları, özetleri ve özel maskeleme ifadeleri birbirinden ayrıdır. Profil silme geri alınamaz; gerekiyorsa önce veri dışa aktarımı yapın.

## 4. Özetler, arama ve görevler

Ana pano toplam ileti, yüksek öncelikli ileti ve açık görev sayısını gösterir. **Bugün** ve **Son 7 gün** seçenekleri yalnızca seçili profile ait kaynaklı özet üretir.

Arama kutusu ileti başlığı ve gövdesinde çalışır. Analizden çıkarılan bir görevi tamamladığınızda onay kutusunu işaretleyin; okul sistemine hiçbir işlem gönderilmez, durum yalnızca yerel veritabanında tutulur.

## 5. Takvime aktarma

**Takvimi indir** düğmesi standart `.ics` dosyası oluşturur. Yalnızca iletide açıkça yazılmış, yılı bulunan tam tarihler eklenir; sistem tahminî tarih üretmez.

Takvim dosyası profil adı, ileti başlığı ve görev metni içerebilir. Dosyayı çevrim içi takvime yüklemeden önce o hizmetin gizlilik koşullarını değerlendirin.

## 6. AI seçenekleri ve onay

Varsayılan **yerel kural analizi** hiçbir AI servisine bağlanmaz. İsteğe bağlı olarak Responses-uyumlu yerel model veya uzak AI servisi yapılandırılabilir.

AI etkin olsa bile içerik otomatik gönderilmez. Her ileti analizi ve her soru için:

1. Uygulama seçilen alanları ve yaklaşık karakter sayısını gösterir.
2. E-posta, telefon ve profil için tanımladığınız özel ifadeler varsayılan olarak maskelenir.
3. Yalnızca siz onay verirseniz istek yapılır.

Soru-cevap özelliği ilgili kaynakları önce bilgisayarda seçer, en fazla beş ileti gönderir ve yanıtın kaynak kimliklerini gerçekten gönderilen kayıtlarla sınırlar. AI yanıtları hata yapabilir; özgün ileti kartına dönerek doğrulayın.

Yerel model ayarı için [README](../README.md), veri akışlarının ayrıntıları için [gizlilik belgesi](../PRIVACY.md) kullanılabilir.

## 7. Özel ifade maskeleme

Profil ayarlarında çocuk adı, öğretmen adı veya okul adı gibi ifadeler ekleyebilirsiniz. Bu liste yalnızca yerel veritabanında tutulur. AI çağrısında liste gönderilmez; yalnızca metindeki eşleşmeler maskeleme etiketiyle değiştirilir.

Maskeleme, tüm kişisel bilgileri otomatik tanıma garantisi vermez. Önizlemeyi her gönderimden önce okuyun.

## 8. Veriyi indirme ve silme

**Veriyi indir** işlemi profilleri, iletileri, analizleri ve yerel ayarları JSON dosyasına aktarır. Bu dosya gerçek okul verisi içerebilir; ortak veya bulutla eşitlenen klasörlerde bırakmayın.

Arayüzden tek bir iletiyi, seçili profilin iletilerini veya profili tüm ilişkili verileriyle silebilirsiniz. Son profil silinirse ilk kurulum ekranı yeniden açılır. Dosya düzeyinde yedekleme için uygulamayı önce durdurun ve [kurulum rehberindeki](INSTALL.md) adımları izleyin.

## 9. Güvenli kullanım özeti

- Uygulamayı İnternet'e veya yerel ağ arayüzüne açmayın.
- K12 parolasını, oturum çerezini veya API anahtarını ileti alanına yapıştırmayın.
- Gerçek okul verisini GitHub issue, ekran görüntüsü veya hata kaydında paylaşmayın.
- Bilgisayarı başkalarıyla paylaşıyorsanız işletim sistemi hesabını kilitleyin.
- Acil veya hukuki sonuç doğuran konularda okulun özgün iletisini ve resmî kanalını kullanın.

Bir güvenlik sorunu bulursanız gerçek çocuk verisi kullanmadan [güvenlik politikasındaki](../SECURITY.md) özel bildirim yolunu izleyin.

## 10. Sorun giderme

Uygulama açılmıyorsa proje klasöründe `npm run doctor` çalıştırın. Node.js sürümü, veri dizini ve AI ayarları denetlenir.

- Port kullanımda: `PORT` değerini değiştirin veya eski Eğitim Pusulası sürecini kapatın.
- AI düğmesi görünmüyor: AI ayarı kapalıdır; yerel kural analizi çalışmaya devam eder.
- Yerel model yanıt vermiyor: model servisinin Responses biçimini desteklediğini ve yapılandırılan adreste çalıştığını doğrulayın.
- K12 otomatik yenileme görünmüyor: özellik gerçek cihaz oturumunda henüz doğrulanmamıştır; elle içe aktarmayı kullanın.

Teknik hata bildirirken uygulama sürümünü, işletim sistemini ve sentetik yeniden üretim adımlarını yazın; gerçek mesaj, öğrenci adı, parola veya ekran görüntüsü eklemeyin.
