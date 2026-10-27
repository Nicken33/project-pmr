package main

import (
	"encoding/json"
	"fmt"
	"os"
)

const esc_clear = "\033[H\033[2J"

/*type ScheduleItem struct {
	DaysOfWeek int
	Time string
}*/

type Activity struct {
	Name     string `json:"name"`
	Price    int    `json:"price"`
	City     string `json:"city"`
	AgeFrom  int    `json:"age_from"`
	Category string `json:"category"`
	//Place string
	//Schedule []ScheduleItem
}

type Filter struct {
	name       string
	city       string
	price_from int
	price_to   int
	category   string
	fromAge    int
}

func main() {
	data, err := os.ReadFile("activities.json")
	if err != nil {
		fmt.Println("Ошибка при чтении файла: ", err)
		return
	}

	var activities []Activity
	err = json.Unmarshal(data, &activities)
	if err != nil {
		fmt.Println("Ошибка при разборе JSON: ", err)
		return
	}

	var scen string
	var filter Filter

	var srch bool = false
	var quit bool = false

	for !srch && !quit {
		fmt.Println(esc_clear)
		fmt.Println("1. Название")
		fmt.Println("2. Город")
		fmt.Println("3. Цена")
		fmt.Println("4. Категория")
		fmt.Println("5. Возраст")
		fmt.Println("s - Начать поиск")
		fmt.Println("q - Выйти")

		fmt.Scan(&scen)
		fmt.Println(esc_clear)
		switch scen {
		case "1":
			fmt.Print("Введите название: ")
			fmt.Scan(&filter.name)
		case "2":
			fmt.Print("Введите город: ")
			fmt.Scan(&filter.city)
		case "3":
			fmt.Print("Введите цену от: ")
			fmt.Scan(&filter.price_from)
			fmt.Print("Введите цену до: ")
			fmt.Scan(&filter.price_to)
		case "4":
			fmt.Print("Введите категорию: ")
			fmt.Scan(&filter.category)
		case "5":
			fmt.Print("Введите возраст: ")
			fmt.Scan(&filter.fromAge)
		case "s":
			srch = true
		case "q":
			quit = true
		}
	}
	var found bool = false
	if srch {
		for _, activity := range activities {
			suits := true
			if filter.name != "" && filter.name != activity.Name {
				suits = false
			} else if filter.city != "" && filter.city != activity.City {
				suits = false
			} else if filter.price_from != 0 && filter.price_to != 0 && (filter.price_from > activity.Price || filter.price_to < activity.Price) {
				suits = false
			} else if filter.category != "" && filter.category != activity.Category {
				suits = false
			} else if filter.fromAge != 0 && filter.fromAge < activity.AgeFrom {
				suits = false
			}
			if suits {
				found = true
				fmt.Printf(" - %s - \nГород: %s\nЦена: %d\nКатегория: %s\nВозраст: от %d лет\n\n", activity.Name, activity.City, activity.Price, activity.Category, activity.AgeFrom)
			}
		}
	}
	if !found {
		fmt.Println("Ничего не нашлось по вашим запросам")
	}
}
