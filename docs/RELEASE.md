# Sürüm ve GitHub yayın rehberi

Bu proje henüz herkese açık bir uzak depoya bağlı değildir. İlk yayın, aşağıdaki kapılar tamamlanmadan yapılmamalıdır.

## Bir defalık depo hazırlığı

1. Depo sahibi ve `egitim-pusulasi` gibi kalıcı depo adı belirlenir.
2. Kullanıcının seçtiği açık kaynak lisansı `LICENSE` dosyasına eklenir.
3. `.github/ISSUE_TEMPLATE/config.yml` içindeki `OWNER/REPOSITORY` güvenlik bağlantısı gerçek depo yolu ile değiştirilir.
4. GitHub özel güvenlik bildirimleri etkinleştirilir ve [SECURITY.md](../SECURITY.md) gerçek özel bildirim kanalını gösterecek şekilde güncellenir.
5. Ana dal koruması; pull request, başarılı CI ve force-push engeliyle yapılandırılır.
6. Depo açıklamasında projenin K12 ile resmî bağlantısı olmadığı belirtilir.

## Her sürümden önce

```powershell
npm ci --ignore-scripts
npm run check
npm test
npm run audit:release
npm run release:verify -- v0.1.0
```

Son komut ancak etiket `package.json` sürümüyle eşleşirse, lisans ve zorunlu topluluk/güvenlik belgeleri varsa ve örnek GitHub güvenlik bağlantıları gerçek depo bilgileriyle değiştirilmişse başarılı olur. Hassas veri denetimi çalışma ağacını ve tüm Git geçmişini tarar.

Ek kontroller:

- `git status --short` boş olmalıdır.
- `ROADMAP.md` içindeki yayın kapıları gözden geçirilmelidir.
- Docker motoru varsa `docker compose up --build` ile gerçek imaj duman testi yapılmalıdır.
- Arşivde `data/`, `work/`, APK, ağ kaydı veya yerel veritabanı bulunmadığı doğrulanmalıdır.
- Sürüm notları kullanıcı açısından veri şeması ve gizlilik değişikliklerini belirtmelidir.

## Otomatik yayın

`vMAJOR.MINOR.PATCH` etiketi gönderildiğinde `.github/workflows/release.yml`:

1. Test, sözdizimi ve yayın denetimlerini çalıştırır.
2. Etiket-sürüm, lisans ve gerçek depo güvenlik bağlantıları kapısını doğrular.
3. Yalnızca Git tarafından izlenen dosyalardan `.zip` ve `.tar.gz` üretir.
4. Her arşiv için `SHA256SUMS.txt` oluşturur.
5. Etikete bağlı GitHub Release yayımlar.

Lisans eksikken veya sürüm uyuşmazken iş akışı bilinçli olarak başarısız olur. Etiket oluşturmak dış yayımdır; kullanıcı onayı ve son kontrol olmadan yapılmamalıdır.

## Geri alma

Hatalı sürümde GitHub Release taslak hâline alınır veya kaldırılır; etiket silmeden önce indiren kullanıcılara etkisi değerlendirilir. Hassas veri yayımlandıysa yalnızca dosyayı silmek yeterli değildir: güvenlik olayı süreci başlatılır, sırlar döndürülür ve Git geçmişi uzman gözetiminde temizlenir.
