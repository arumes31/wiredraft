// Command checkcoverage enforces a total Go statement coverage threshold.
package main

import (
	"bufio"
	"flag"
	"fmt"
	"os"
	"strconv"
	"strings"
)

func main() {
	profile := flag.String("profile", "coverage.out", "Go coverage profile")
	minimum := flag.Float64("minimum", 80, "minimum statement coverage percent")
	flag.Parse()
	file, err := os.Open(*profile)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}
	defer file.Close()
	var statements, covered uint64
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) != 3 || strings.HasPrefix(fields[0], "mode:") {
			continue
		}
		count, countErr := strconv.ParseUint(fields[1], 10, 64)
		hits, hitsErr := strconv.ParseUint(fields[2], 10, 64)
		if countErr != nil || hitsErr != nil {
			fmt.Fprintf(os.Stderr, "invalid coverage row %q\n", scanner.Text())
			os.Exit(2)
		}
		statements += count
		if hits > 0 {
			covered += count
		}
	}
	if err := scanner.Err(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}
	percentage := 0.0
	if statements > 0 {
		percentage = float64(covered) / float64(statements) * 100
	}
	fmt.Printf("Go statement coverage: %.2f%% (required %.2f%%)\n", percentage, *minimum)
	if percentage < *minimum {
		os.Exit(1)
	}
}
