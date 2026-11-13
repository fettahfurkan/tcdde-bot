# TCDD Koltuk Takip — Chrome eklentisi

Güncel sürüm **1.1.0**. Sekmeyi baştan yüklemek yerine sitede bir sonraki tarihe geçip tekrar eski tarihe dönerek koltukları sayfa içinde hızlıca yeniler. O an ekranda seçili olan **herhangi bir tek yön TCDD güzergâhını** (kalkış → varış) destekler. Telegram kurulumunda eksik adım açıkça gösterilir ve bulunan sohbetler pencere kapatılsa da korunur. Her kullanıcı kendi BotFather anahtarını eklentiden girerek Telegram bildirimi bağlayabilir. Saat aralığı ve yenileme süresi değişiklikleri otomatik uygulanır; Kaydet/Güncelle düğmesi gerekmez. Kontrol aralığı en az 1 saniyedir.

**İlk kurulum için:** [Adım adım kurulum ve kişisel Telegram bağlantısı](tcdd-koltuk-takip/KURULUM.md). ZIP paketinin içindeki `KURULUM.md` de aynı yönergedir.

Python veya terminal gerektirmez. Normal açtığınız Chrome/Brave içindeki TCDD sefer listesinde çalışır. Açık aramanın tarihi ve seçili güzergâhı kullanılır. Eklentiden **kontrol aralığı** girilir; Başlat'a basılınca sayfa hemen ve ardından bu aralıkla yenilenir. Yenilenen listedeki **DSB / tekerlekli sandalye** yerleri normal koltuklara eklenmez.

## Kurulum

1. Chrome'da `chrome://extensions`, Brave'de `brave://extensions` açın.
2. **Geliştirici modu**nu açın.
3. **Paketlenmemiş öğe yükle** düğmesine basın.
4. Bu projenin içindeki **tcdd-koltuk-takip** klasörünü seçin. ZIP'ten kuruyorsanız ZIP'i çıkarıp içinde doğrudan `manifest.json` bulunan klasörü seçin. ZIP dosyasını seçmeyin.
5. Eklentiyi araç çubuğuna sabitleyin.

## Kullanım

1. TCDD'yi normal açın. İstediğiniz güzergâh için **tek yön** araması yapın ve istediğiniz tarihi seçin. Seferlerin listelendiği ekranda kalın.
2. Eklentinin simgesine tıklayın. Gösterilen tarihi kontrol edin.
3. Kontrol aralığını saniye cinsinden girin (varsayılan 10, en az 1). Örneğin 1, 5, 10 veya 30 seçebilirsiniz.
4. **Aranacak seferlerin kalkış saatleri** alanında örneğin 08:00–18:30 seçin. Yalnızca bu aralıktaki seferler bildirilir; başlangıç/bitiş dahil ve Türkiye saatidir. Tüm gün için 00:00–23:59 bırakın. Tarih eklentiden değiştirilmez; açık aramanın tarihi kullanılır.
5. **Başlat**a basın. Eklenti penceresi kapansa da takip sürer. **Durdur** ile biter.

Yer bulununca masaüstü bildirimi, araç çubuğunda **VAR** işareti ve isteğe bağlı ses verilir. **Uyarıyı dene** düğmesiyle ses/bildirimi kontrol edebilirsiniz. Varsayılan olarak yer bulununca yenileme durur; isterseniz bu seçeneği kaldırabilirsiniz. Bildirime tıklamak takip sekmesini öne getirir. Koltuk tutulmaz, bilet alınmaz.

Saat aralığını, kontrol süresini veya uyarı seçeneklerini değiştirmek yeterlidir; geçerli seçimler otomatik saklanır. Takip açıkken saat değişikliği son kontrol listesini yeni aralığa göre hemen süzer ve güncel sonuç almak için yeni kontrol başlatır. Sayfa zaten yükleniyorsa ikinci yenileme yapılmaz; gelen sonuç yeni saatlere göre değerlendirilir. Süre değişikliği bekleyen zamanlayıcıyı yeni süreye göre ayarlar. Popup kapatılsa da son seçim korunur. Geçersiz/eksik bir saat yazılırsa önceki geçerli ayar korunur ve açıklama gösterilir.

**Başlat** ilk takibi açmak veya durmuş takibe yeniden başlamak içindir. Takip kapalıyken ayar değiştirmek kendiliğinden takip başlatmaz. Seçilen kontrol süresi, sonuç başarıyla okunduktan sonraki beklemedir; sayfanın yükleme süresi buna eklenir. Yenilemeler üst üste bindirilmez. Kısa süreler sekme içi zamanlayıcıyla, ek olarak tarayıcı alarmıyla yürütülür. İki zamanlayıcı birlikte tetiklense de yalnızca bir yenileme yapılır. Arka plandaki veya uyuyan sekmelerde tarayıcı zamanlamayı geciktirebilir; kesin saniye garantisi yoktur.

Tarayıcı ve takip sekmesi açık, bilgisayar uyanık kalmalıdır. İşletim sistemi bildirimleri engelliyorsa masaüstü uyarısı görünmeyebilir. Tarayıcı yeniden başlatılırsa takip otomatik başlamaz; doğru seferde Başlat'a yeniden basın.

## Yenileme ve doğrulama

Eklenti gerçek sekme yenilemesi yapar (`tabs.reload`, önbelleği atlayarak). Yeni belge yüklenmeden önceki sayfadaki koltukları güncel kabul etmez. TCDD yenilemede arama bilgisini kaybederse, yalnızca kaydedilen tarih/güzergâh/yolcu adetleri TCDD'nin arama durumuna geri konur ve kendi sefer listesi yeniden açılır. Ayrı bir HTTP istemcisi, tarayıcı otomasyonu, çerez aktarımı veya gizleme yöntemi kullanılmaz.

**Güvenlik doğrulaması çıkarsa takip duraklatılır.** Doğrulamayı kendiniz tamamlayın; doğru sefer listesini açıp Başlat'a tekrar basın. Doğrulama çözülmez veya atlanmaz. Bağlantı/okuma hatası ve boş liste “yer yok” olarak kabul edilmez. Tarih veya güzergâh değişirse ya da koltuk seçimi/ödeme ekranına geçilirse yenileme durur.

Sefer okuma yalnızca `ebilet.tcddtasimacilik.gov.tr` üzerinde çalışır. TCDD kimlik, parola, ödeme, çerez veya oturum tokenları okunmaz. Telegram'ı bağlayan kullanıcı için yalnızca resmi `api.telegram.org` adresiyle iletişim kurulur; başka bir aracı sunucu kullanılmaz. Saklanan bilgiler açık aramanın tarihi/güzergâhı/yolcu adetleri, takip ayarları ve son kontrolün sefer/koltuk listesidir. Tam son liste saat filtresi değiştiğinde görüntüyü yeniden süzmek için tutulur; eski veriden yeni müsaitlik bildirimi üretilmez.

## Kişisel Telegram bildirimi

Ortak bot veya pakete gömülü anahtar yoktur. Her kullanıcı kendi botunu kendi Chrome/Brave profilinde bağlar:

1. Telegram'da BotFather ile bot oluşturun ve verdiği API anahtarını alın.
2. Kendi botunuzu Telegram'da açıp `/start` gönderin.
3. Eklentide **Telegram bildirimi** bölümünü açın. **Bot anahtarı** alanına kendi anahtarınızı girin. İsterseniz **Anahtar / ayar dosyasından bağla** ile bir TXT dosyası veya `botToken` ve isteğe bağlı `chatId` alanları içeren JSON seçebilirsiniz.
4. **Botu bağla / sohbeti bul** düğmesine basın. Bulunan özel sohbetlerden **bildirimin gönderileceği kendi sohbetinizi seçin**. Tek sohbet olsa da hedefi kullanıcı seçer. Hiç sohbet bulunmazsa doğru bota `/start` veya normal bir mesaj gönderip yeniden deneyin. Bot başka bir uygulamada kullanılıyorsa mesajları o uygulama alıyor olabilir; bildiğiniz sohbet ID'sini elle de girebilirsiniz.
5. **Telegram'a da bildir** açıkken normal koltuk uyarısı yalnızca seçilen sohbete gider. **Deneme mesajı** ile bağlantıyı sınayın. Grup/kanal için bildiğiniz sayısal sohbet ID'sini elle girmeniz ve bota gereken mesaj iznini vermeniz gerekir.

BotFather anahtarı eklentideki **BotFather API anahtarı** alanına girilir. Telegram'daki bot sohbetine `/start` veya normal bir mesaj gönderilir. Anahtarı sohbet mesajı olarak göndermek eklentiyi bağlamaz. Durum **Anahtar gerekli**, **Sohbet seçilmeli**, **Bildirim kapalı** veya **Açık** olarak gösterilir. Bulunan hedef listesi popup yeniden açıldığında da korunur.

Telegram bağlı değilken veya kapalıyken bulunan koltuklar için geriye dönük mesaj gönderilmez. Böyle bir durumda gönderilmeme nedeni Telegram bölümünde gösterilir. Önce Deneme mesajı'nın ulaştığını doğrulayın; ardından sefer takibini **Başlat** ile yeniden açarak güncel koltuk sorgusu yapın.

Mesaj, seçilen aralıktaki yeni müsait seferlerin tarihi, saati, adı, normal koltuk sayısı ve kontrol zamanını içerir. DSB yerleri bildirim sebebi değildir. Sürekli müsait kalan aynı sefer tekrar tekrar gönderilmez. Telegram hatası masaüstü bildirimini veya takibi durdurmaz. Geçici ağ/hız sınırı hataları en fazla iki kez daha denenir; üç dakikadan eski bir mesaj güncelmiş gibi gönderilmez. Yeni bir uyarı bekleyen eski bilgiyi yeniler. Gönderim durumu Telegram bölümünde gösterilir.

Anahtar `storage.local` içinde yalnızca eklentinin güvenilir arayüz/arka plan bağlamlarına açık tutulur; TCDD sayfasına, içerik betiklerine, senkron depolamaya veya ZIP'e yazılmaz. Tarayıcı depolaması şifreli bir anahtar kasası değildir; profilinizi paylaşmayın. **Bağlantıyı kaldır** anahtarı ve bekleyen mesajı siler. Hedef veya bot değişirse önceki hedef için bekleyen bildirim yeni sohbete aktarılmaz. İzinler: yerel ayar, zamanlayıcı, sayfa okuma, bildirim ve ses; Telegram için yalnızca resmi API adresine erişim.

## Doğrulama ve sınırlar

Geliştirici kontrolü: `tcdd-koltuk-takip` klasöründe `node --test tests/*.test.js`.

Testler DSB ayrımı, saat filtresi, yenileme, otomatik ayar, Telegram hedef seçimi, anahtarın arayüz yanıtlarından gizlenmesi, mesaj kapsamı, ağ hatası/yeniden deneme ve eski mesajları reddetmeyi kapsar. Eklenti denemeleri sahte anahtar ve örnek Telegram/TCDD yanıtlarıyla yapılır; gerçek kullanıcıya test mesajı gönderilmez. Canlı TCDD erişimi ve doğrulama ekranının geçilmesi garanti edilmez. Site bileşenleri değişirse eklentinin uyarlanması gerekebilir. Bu sürüm seçili tek yön güzergâh ve direkt seferler içindir.
