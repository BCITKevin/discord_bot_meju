const { Client, GatewayIntentBits, EmbedBuilder, REST, SlashCommandBuilder, Routes, InteractionCollector, ActivityType } = require('discord.js'); // discord.js 라이브러리 호출
const { config } = require('dotenv');

config();

const token = process.env.DISCORD_TOKEN;
const API_KEY = process.env.API_KEY;
const clientId = process.env.CLIENT_ID;
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// discord 봇이 실행될 때 딱 한 번 실행할 코드를 적는 부분
client.once('ready', () => {
	console.log('Ready!');
    client.user.setActivity({
        name: 'Discord 봇 개발',
        type: ActivityType.Playing,
    })
});

const commands = [
    new SlashCommandBuilder()
        .setName('배그전적')
        .setDescription('플레이어의 최근 배틀그라운드 매치를 확인합니다.')
        .addStringOption(option => 
            option.setName('pubg_name')
                .setDescription('플레이어의 이름을 입력하세요.')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('안녕메주')
        .setDescription('메주봇이 인사합니다.'),
    new SlashCommandBuilder()
        .setName('랜덤뽑기')
        .setDescription('서버 내에 있는 유저들중 랜덤으로 한명을 뽑습니다.'),
    new SlashCommandBuilder()
        .setName('은밀하게')
        .setDescription('....'),
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName, options, guild } = interaction;

    // 명령어 처리
    if (commandName === '배그전적') {
        const playerName = options.getString('pubg_name');
        const matchDetails = await fetchPlayerData(playerName);
        
        if (matchDetails) {
            const { duration, date, mapName, teammates } = matchDetails;

            let teammateNames = teammates.map(teammate => teammate.attributes.stats.name).join(', ');

            const embedFields = [
                { name: '날짜', value: `${date}`, inline: true },
                { name: '생존시간', value: `${duration}분`, inline: true },
                { name: '맵', value: `${mapName}`, inline: true }
            ];

            if (teammates.length > 0) {
                embedFields.push({ name: '스쿼드', value: teammateNames, inline: true });
                teammates.forEach(teammate => {
                    embedFields.push({ 
                        name: teammate.attributes.stats.name, 
                        value: `데미지: ${teammate.attributes.stats.damageDealt}, 킬수: ${teammate.attributes.stats.kills}, 등수: ${teammate.attributes.stats.winPlace}`, 
                        inline: true 
                    });
                });
            } else {
                embedFields.push({ name: '스쿼드', value: '없음', inline: true });
            }

            const exampleEmbed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(`${playerName}의 최근 매치`)
                .setDescription(`${playerName}의 제일 최근 매치 결과 입니다.`)
                .setThumbnail('https://i.pinimg.com/originals/f7/43/c4/f743c45a69f00a4d6254ce42f3803dd1.jpg')
                .addFields(...embedFields)
                .setTimestamp()
                .setFooter({ text: '푸터 텍스트', iconURL: 'https://i.imgur.com/AfFp7pu.png' });

            await interaction.reply({ embeds: [exampleEmbed] });
        } else {
            await interaction.reply('최근 매치 정보를 가져오는 데 문제가 발생했습니다.');
        }
    } else if (commandName === '안녕메주') {
        await interaction.reply("안녕하세요, 메주봇입니다!");
    } else if (commandName  === '랜덤뽑기') {
        try {
            let user = [];
            const members = await guild.members.fetch();
            members.map(member => user.push(member.user.id));
            const newUser = user.filter(u => u !== "1263899843055583254");

            const randomUserId = randomUser(newUser);
            const userData = members.find(member => member.user.id === randomUserId);
            
            const exampleEmbed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(`${userData.user.globalName}님 당첨!`)
                .setThumbnail(`https://cdn.discordapp.com/avatars/${userData.user.id}/${userData.user.avatar}.png`)
                .addFields(
                    {name: "아이디", value: `${userData.user.id}`},
                    {name: "유저이름", value: `${userData.user.username}`},
                )
                .setTimestamp()

            await interaction.reply({ embeds: [exampleEmbed] });

        } catch(error) {
            console.error(error);
            await interaction.reply('유저 정보를 가져오는데 문제가 발생했습니다.');
        }
    } else if (commandName === "은밀하게") {
        await interaction.reply('...위대하게');
    }
});

// 봇과 서버를 연결해주는 부분
client.login(token);

function randomNum(min, max) {
    const num = Math.floor(Math.random() * (max - min)) + min;
    return num;
}

function randomUser(arr) {
    const user = arr[randomNum(0, arr.length)];
    return user;
}

async function fetchPlayerData(playerName) {
    const url = `https://api.pubg.com/shards/steam/players?filter[playerNames]=${playerName}`;
    console.log(playerName);
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Accept': 'application/vnd.api+json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        const playerId = data.data[0].id;
        const player_match_datas = data.data[0].relationships.matches.data;
        const last_Match_datas = player_match_datas.slice(0);

        // Fetch match details and wait for results\
        const matchDetails = await fetchMatchDetails(last_Match_datas, playerId);

        return matchDetails;
    } catch (error) {
        console.error('Error fetching player data:', error);
    }
}

async function fetchMatchDetails(matchArr, playerId) {
    try {
        for (const matchData of matchArr) {
            const url = `https://api.pubg.com/shards/steam/matches/${matchData.id}`;
    
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Accept': 'application/vnd.api+json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
    
            const data = await response.json();
            const livetime = data.data.attributes.duration / 60;
            const duration = livetime.toFixed(2);

            const createdAt = data.data.attributes.createdAt
            const newDate = new Date(createdAt)
            const year = newDate.getFullYear();
            const month  = newDate.getMonth() + 1;
            const day =  newDate.getDate();
            const date = `${year}/${month}/${day}`

            const mapName = data.data.attributes.mapName

            const participants = data.included.filter(player => player.type === 'participant');
            const rosters = data.included.filter(player => player.type === 'roster');
            const player = participants.filter(player => player.attributes.stats.playerId === playerId);

            let teammates = [];
            if (!data.data.attributes.gameMode.includes("solo")) {
                const playerRoster = rosters.find(roster => 
                    roster.relationships.participants.data.some(p => p.id === player[0].id)
                );
                
                if (!playerRoster) {
                    console.log('Player roster not found.');
                    continue;
                }
                
                // 팀원의 ID 리스트
                const teammateIds = playerRoster.relationships.participants.data.map(p => p.id);
                
                // 팀원의 정보 추출
                teammates = participants.filter(participant => teammateIds.includes(participant.id));
            }
            return { duration, date, mapName, teammates };
        }
    } catch (error) {
        console.error('Error fetching match details:', error);
    }
}
