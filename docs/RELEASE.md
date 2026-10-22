# Sürüm ve GitHub yayın rehberi

Projenin ana deposu `https://github.com/cdatac/egitim-pusulasi` adresindedir. Yayınlar aşağıdaki kapılar tamamlanmadan yapılmamalıdır.

## Bir defalık depo hazırlığı

1. Depo sahibi ve kalıcı depo adı doğrulanır.
2. Kullanıcının seçtiği açık kaynak lisansının `LICENSE` dosyasında bulunduğu doğrulanır.
3. `.github/ISSUE_TEMPLATE/config.yml` içindeki güvenlik bağlantısının gerçek depo yolunu kullandığı doğrulanır.
4. GitHub özel güvenlik bildirimleri etkinleştirilir ve [SECURITY.md](../SECURITY.md) gerçek özel bildirim kanalını gösterir.
5. Ana dal koruması; pull request, başarılı CI ve force-push engeliyle yapılandırılır.
6. Depo açıklamasında projenin K12 ile resmî bağlantısı olmadığı belirtilir.

## Her sürümden önce

```powershell
npm ci --ignore-scripts
npm run check
npm test
npm run audit:release
npm run release:verify -- v0.2.1
```

Son komut ancak etiket `package.json` sürümüyle eşleşirse, lisans ve zorunlu topluluk/güvenlik belgeleri varsa ve örnek GitHub güvenlik bağlantıları gerçek depo bilgileriyle değiştirilmişse başarılı olur. Hassas veri denetimi çalışma ağacını ve tüm Git geçmişini tarar.

Ek kontroller:

- `git status --short` boş olmalıdır.
- `ROADMAP.md` içindeki yayın kapıları gözden geçirilmelidir.
- Docker motoru varsa `docker compose up --build` ile gerçek imaj duman testi yapılmalıdır.
- Arşivde `data/`, `work/`, APK, ağ kaydı veya yerel veritabanı bulunmadığı doğrulanmalıdır.
- Sürüm notları kullanıcı açısından veri şeması ve gizlilik değişikliklerini belirtmelidir.

## Otomatik yayın

Değişiklikler önce korumalı `main` dalına pull request ile birleştirilir. Etiket yalnızca bundan sonra, `main` üzerindeki doğrulanmış commit'e verilir. `vMAJOR.MINOR.PATCH` etiketi gönderildiğinde `.github/workflows/release.yml`:

1. Etiket commit'inin `origin/main` geçmişinde olduğunu doğrular.
2. Test, sözdizimi ve yayın denetimlerini çalıştırır.
3. Etiket-sürüm, lisans ve gerçek depo güvenlik bağlantıları kapısını doğrular.
4. Yalnızca Git tarafından izlenen dosyalardan `.zip` ve `.tar.gz` üretir.
5. Her arşiv için `SHA256SUMS.txt` oluşturur.
6. Etikete bağlı GitHub Release yayımlar.

Lisans eksikken veya sürüm uyuşmazken iş akışı bilinçli olarak başarısız olur. Etiket oluşturmak dış yayımdır; kullanıcı onayı ve son kontrol olmadan yapılmamalıdır.

## Geri alma

Hatalı sürümde GitHub Release taslak hâline alınır veya kaldırılır; etiket silmeden önce indiren kullanıcılara etkisi değerlendirilir. Hassas veri yayımlandıysa yalnızca dosyayı silmek yeterli değildir: güvenlik olayı süreci başlatılır, sırlar döndürülür ve Git geçmişi uzman gözetiminde temizlenir.
