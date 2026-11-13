# TCDD Koltuk Takip — Chrome / Brave kurulumu

Sürüm **1.1.0**. Güncellemeden sonra `chrome://extensions` içindeki eklenti kartının **Yeniden yükle** simgesine basın. Sekmeyi baştan yüklemek yerine sitede bir sonraki tarihe geçip tekrar eski tarihe dönerek koltukları çok daha hızlı yeniler. O an ekranda seçili olan **herhangi bir tek yön TCDD güzergâhını** (kalkış → varış) destekler.

Telegram kullanımı isteğe bağlıdır. Telegram isteyen her kullanıcı aşağıdaki kurulumu kendi botuyla yapar; ortak bot veya hazır anahtar bulunmaz.

## Eklentiyi yükleme ve takibi başlatma

1. ZIP indirdiyseniz önce çıkarın.
2. Chrome'da `chrome://extensions`, Brave'de `brave://extensions` açın.
3. **Geliştirici modu**nu açın, **Paketlenmemiş öğe yükle** düğmesine basın.
4. İçinde doğrudan `manifest.json` bulunan klasörü seçin. ZIP bu dosyayı en üst düzeyde içerir; fazladan bir alt klasör seçmek gerekmez.
5. TCDD'de istediğiniz güzergâh için tek yön araması yapın ve istediğiniz tarihi açın.
6. Eklenti simgesine tıklayın. Kontrol aralığını saniye olarak girip **Başlat**a basın.

Varsayılan aralık 10 saniyedir; en az **1 saniye** seçilebilir. Süre, sonuç okunduktan sonraki beklemedir; sayfa yüklenirken ikinci bir yenileme yapılmaz. Tarayıcı arka planda beklemeyi uzatabilir.

**Aranacak seferlerin kalkış saatleri** alanında örneğin **08:00–18:30** seçin. Yalnızca bu saatlerde kalkan seferler sayılır ve bildirilir; sınırlar dahildir. Saatler Türkiye saatidir. Tüm gün için 00:00–23:59 bırakın. Eklenti açık aramanın tarihini kullanır. Saatleri veya kontrol süresini değiştirmeniz yeterlidir; seçim otomatik uygulanır. Sayfa yüklenirken değiştirirseniz gelen sonuç yeni saat aralığına göre değerlendirilir. Takip kapalıysa ayarlar saklanır, Başlat'a bastığınızda kullanılır.

Her kontrolde tam sekme yenilemesi yapmak yerine sitede bir sonraki tarihe geçip tekrar seçtiğiniz tarihe dönülerek sefer listesi tazelenir (arayüze erişilemezse yedek olarak tam yenileme kullanılır). Normal koltuk bulunursa bildirim ve isteğe bağlı ses verilir. DSB / tekerlekli sandalye yerleri sayılmaz. Varsayılan olarak yer bulununca yenileme durur. **Durdur** ile takibi istediğiniz zaman kapatabilirsiniz. **Uyarıyı dene** ile ses/bildirimi deneyin.

Doğrulama çıkarsa takip durur. Kendiniz doğrulayıp sefer listesini açın ve Başlat'a yeniden basın. Tarayıcı/sekme açık, bilgisayar uyanık kalmalıdır. Koltuk tutulmaz ve bilet alınmaz.

## Her kullanıcı için kişisel Telegram kurulumu

### 1. Kendi botunuzu oluşturun

1. Telegram'da [@BotFather](https://t.me/BotFather) sohbetini açın ve `/newbot` gönderin.
2. BotFather'ın istediği bot adını ve kullanıcı adını belirleyin.
3. BotFather'ın verdiği **HTTP API anahtarını** kopyalayın. Bu anahtar sizin botunuza aittir.
4. Oluşturduğunuz **kendi botunuzun sohbetini** açıp **Başlat** düğmesine basın veya `/start` gönderin.

### 2. Eklentide anahtarınızı girin ve hedefi seçin

1. Eklenti simgesine tıklayıp **Telegram bildirimi** bölümünü açın.
2. **Bot anahtarı** alanına kendi BotFather anahtarınızı yapıştırın. Alternatif olarak **Anahtar / ayar dosyasından bağla** ile anahtarınızın bulunduğu TXT dosyasını seçin. JSON dosyasında `botToken` ve isteğe bağlı `chatId` alanları kullanılabilir.
3. **Sohbet ID** alanını bilmiyorsanız boş bırakın ve **Botu bağla / sohbeti bul** düğmesine basın.
4. Açılan listeden bildirimin gönderileceği **kendi özel sohbetinizi seçin**. Tek sohbet bulunsa bile hedefi seçmeniz gerekir. Sohbet ID'nizi biliyorsanız doğrudan alana yazabilirsiniz.
5. **Telegram'a da bildir** seçeneğinin işaretli olduğunu kontrol edin.
6. **Deneme mesajı** düğmesine basıp mesajın seçtiğiniz Telegram sohbetine geldiğini doğrulayın. Deneme mesajı boş koltuk bulunduğu anlamına gelmez.

**Hangi bilgi nereye yazılır?** BotFather anahtarınızı eklentideki **BotFather API anahtarı** alanına girin. Telegram'da kendi botunuza `/start` gönderin. Anahtarı bot sohbetine mesaj olarak göndermek bağlantı kurmaz.

**Durum göstergesi:** “Anahtar gerekli” anahtarın henüz kaydedilmediğini, “Sohbet seçilmeli” hedefin eksik olduğunu, “Bildirim kapalı” bağlı hedefe gönderimin kapatıldığını belirtir. “Açık” görülmeli ve Deneme mesajı ulaşmalıdır.

Kurulumdan sonra boş koltuk bildirimi **yalnızca seçtiğiniz sohbete** gönderilir; botunuza yazan herkese toplu mesaj atılmaz. Anahtar ve hedef bir kez bağlandıktan sonra aynı tarayıcı profilinde saklanır. Farklı bir kullanıcı veya Chrome/Brave profili kendi anahtarını ve sohbetini bağlar.

Mesajda tarih, sefer saati ve normal koltuk sayısı bulunur. Telegram hatası masaüstü uyarısını durdurmaz. Geçici hatalarda sınırlı yeniden deneme yapılır; gecikmiş mesajlar gönderilmez. **Bağlantıyı kaldır** yerel anahtarı ve bekleyen mesajı siler.

Telegram kurulmadan önce yer bulunmuşsa eski sonuç sonradan gönderilmez. Bağlantıyı kurup Deneme mesajı'nı aldıktan sonra takibi **Başlat** ile yeniden açın; böylece güncel sonuç kontrol edilip Telegram'a bildirilir.

### Telegram sorunlarını giderme

- **Sohbet bulunamadı:** Oluşturduğunuz botun sohbetine `/start` veya normal bir mesaj gönderin; eklentide **Botu bağla / sohbeti bul** düğmesine yeniden basın. Bot başka bir uygulamada da kullanılıyorsa o uygulama mesajları alıyor olabilir; bildiğiniz sohbet ID'sini elle girebilirsiniz.
- **Mesaj gelmiyor:** Hedef sohbeti ve **Telegram'a da bildir** seçeneğini kontrol edin. **Deneme mesajı** gönderip Telegram bölümündeki gönderim durumuna bakın. Botu engellediyseniz engeli kaldırın.
- **Telegram'ı kapatmak istiyorsunuz:** **Telegram'a da bildir** işaretini kaldırın. Anahtarı da silmek için **Bağlantıyı kaldır** düğmesini kullanın. Bilgisayar bildirimi ve sesli takip bundan etkilenmez.
- **Sürüm güncellemesi:** Dosyaları mevcut eklenti klasörüne çıkarıp uzantılar sayfasında **Yeniden yükle ⟳** düğmesine basın. Kartta **1.0.5** görünmeli.

Sefer okuma TCDD sayfasında çalışır; TCDD çerez/oturum tokenı, kimlik veya ödeme bilgisi almaz. Telegram'a bağlanırsanız yalnızca resmi Telegram API'siyle iletişim kurulur. Anahtarınız ve ayarlarınız tarayıcıda yerel olarak saklanır, siteye veya ZIP'e eklenmez. Profilinizi ve anahtar dosyanızı paylaşmayın. Hata veya boş liste “yer yok” olarak kabul edilmez. Canlı TCDD erişimi garanti edilmez.
